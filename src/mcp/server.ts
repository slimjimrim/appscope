import { config } from "dotenv";
config({ path: new URL("../../.env.local", import.meta.url).pathname, quiet: true });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * AppScope MCP server — exposes the tool's App Store data to Claude Code so it
 * can pull reviews, ranks, and research data and produce insight reports.
 * Talks to Apple + Postgres through the same src/lib as the web UI, so it
 * works even when the dev server isn't running.
 */
async function main() {
  const appstore = await import("../lib/appstore");
  const service = await import("../lib/service");
  const { getPopularity } = await import("../lib/searchads");
  const { reviewWordFrequency } = await import("../lib/insights");
  const { runSnapshot } = await import("../lib/snapshot-runner");

  const server = new McpServer({ name: "appscope", version: "1.0.0" });

  const json = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }],
  });

  server.registerTool(
    "search_apps",
    {
      description:
        "Search the iOS App Store. Returns apps with metadata (rating, rating count, price, genre, developer). Result order = App Store search ranking.",
      inputSchema: {
        term: z.string(),
        country: z.string().default("us"),
        limit: z.number().default(20),
      },
    },
    async ({ term, country, limit }) => {
      const results = await appstore.searchApps(term, country, limit);
      return json(
        results.map((a, i) => ({
          rank: i + 1,
          appId: a.appId,
          name: a.name,
          developer: a.developer,
          rating: a.rating,
          ratingCount: a.ratingCount,
          price: a.price,
          genre: a.genre,
        })),
      );
    },
  );

  server.registerTool(
    "get_app",
    {
      description:
        "Full App Store metadata for one app: description, version, release dates, size, languages, screenshots count, etc.",
      inputSchema: { appId: z.number(), country: z.string().default("us") },
    },
    async ({ appId, country }) => json(await appstore.lookupApp(appId, country)),
  );

  server.registerTool(
    "get_reviews",
    {
      description:
        "Stored customer reviews for an app, filterable by country, star rating, and text search. Set sync=true to first pull the latest ~500 reviews from Apple. Includes a word-frequency summary.",
      inputSchema: {
        appId: z.number(),
        country: z.string().default("us"),
        rating: z.number().optional().describe("filter to one star rating 1-5"),
        search: z.string().optional(),
        limit: z.number().default(50),
        sync: z.boolean().default(false),
      },
    },
    async ({ appId, country, rating, search, limit, sync }) => {
      if (sync) await service.syncReviews(appId, [country]);
      const reviews = await service.queryReviews({ appId, country, rating, search, limit: 1000 });
      const stats = await service.reviewStats(appId, country);
      return json({
        totalStored: stats.total,
        distribution: stats.distribution,
        matched: reviews.length,
        frequentTerms: reviewWordFrequency(reviews, 20),
        reviews: reviews.slice(0, limit).map((r) => ({
          rating: r.rating,
          title: r.title,
          body: r.body,
          version: r.version,
          date: r.reviewedAt,
          country: r.country,
        })),
      });
    },
  );

  server.registerTool(
    "list_tracked_apps",
    { description: "Apps being tracked by AppScope, with store country.", inputSchema: {} },
    async () =>
      json(
        (await service.listTrackedApps()).map((a) => ({
          appId: a.appId,
          name: a.name,
          developer: a.developer,
          country: a.country,
          addedAt: a.addedAt,
        })),
      ),
  );

  server.registerTool(
    "track_app",
    {
      description: "Start tracking an app (daily rank/rating/review snapshots).",
      inputSchema: { appId: z.number(), country: z.string().default("us") },
    },
    async ({ appId, country }) => json(await service.trackApp(appId, country)),
  );

  server.registerTool(
    "add_keywords",
    {
      description:
        "Add keywords to a tracked app and immediately check their search ranks.",
      inputSchema: {
        appId: z.number(),
        terms: z.array(z.string()),
        country: z.string().default("us"),
      },
    },
    async ({ appId, terms, country }) => {
      const out = [];
      for (const term of terms) {
        const row = await service.addKeyword(appId, term, country);
        if (row) out.push(await service.checkKeyword(row.id));
      }
      return json(out.map((r) => ({ term: r.term, rank: r.rank, totalResults: r.totalResults })));
    },
  );

  server.registerTool(
    "get_keyword_ranks",
    {
      description:
        "Tracked keywords with latest + previous rank (null rank = not in top 200). Includes per-keyword snapshot history when includeHistory=true.",
      inputSchema: {
        appId: z.number().optional().describe("omit for all tracked apps"),
        includeHistory: z.boolean().default(false),
      },
    },
    async ({ appId, includeHistory }) => {
      const rows = await service.listKeywords(appId);
      if (!includeHistory) return json(rows);
      const withHistory = [];
      for (const row of rows) {
        withHistory.push({ ...row, history: await service.keywordRankHistory(row.id, 180) });
      }
      return json(withHistory);
    },
  );

  server.registerTool(
    "keyword_suggestions",
    {
      description:
        "App Store autocomplete expansions for a seed term (what users actually type), plus keywords shared across the top-10 apps ranking for it.",
      inputSchema: { term: z.string(), country: z.string().default("us") },
    },
    async ({ term, country }) => {
      const [suggestions, topApps] = await Promise.all([
        appstore.expandKeyword(term, country),
        appstore.searchApps(term, country, 10),
      ]);
      return json({
        suggestions,
        competitorKeywords: appstore.extractKeywords(topApps, 25),
        top10: topApps.map((a) => ({ appId: a.appId, name: a.name, ratingCount: a.ratingCount })),
      });
    },
  );

  server.registerTool(
    "keyword_popularity",
    {
      description:
        "Score keywords: Apple Search Ads popularity (5-100) when an ASA session is configured, otherwise a 0-100 difficulty heuristic from top-10 entrenchment. Each term costs ~3s (rate-limited search), so batch sensibly.",
      inputSchema: { terms: z.array(z.string()), country: z.string().default("us") },
    },
    async ({ terms, country }) => json(await getPopularity(terms, country)),
  );

  server.registerTool(
    "compare_apps",
    {
      description: "Side-by-side metadata comparison of 2-4 apps.",
      inputSchema: { appIds: z.array(z.number()), country: z.string().default("us") },
    },
    async ({ appIds, country }) => {
      const apps = await appstore.lookupApps(appIds.slice(0, 4), country);
      return json(
        apps.map((a) => ({
          appId: a.appId,
          name: a.name,
          developer: a.developer,
          price: a.price,
          rating: a.rating,
          ratingCount: a.ratingCount,
          genre: a.genre,
          released: a.releaseDate,
          lastUpdated: a.lastUpdated,
          version: a.version,
          minimumOsVersion: a.minimumOsVersion,
          languages: a.languages.length,
          descriptionFirstParagraph: a.description.split("\n")[0],
        })),
      );
    },
  );

  server.registerTool(
    "get_top_charts",
    {
      description: "Current App Store top charts (top-free or top-paid) for a country.",
      inputSchema: {
        country: z.string().default("us"),
        chart: z.enum(["top-free", "top-paid"]).default("top-free"),
        limit: z.number().default(50),
      },
    },
    async ({ country, chart, limit }) => json(await appstore.fetchTopChart(country, chart, limit)),
  );

  server.registerTool(
    "rating_history",
    {
      description: "Stored rating/rating-count snapshots for a tracked app over time.",
      inputSchema: {
        appId: z.number(),
        country: z.string().default("us"),
        days: z.number().default(180),
      },
    },
    async ({ appId, country, days }) => json(await service.ratingHistory(appId, country, days)),
  );

  server.registerTool(
    "run_snapshot",
    {
      description:
        "Run a full snapshot pass now (keyword ranks, ratings, new reviews, charts for all tracked apps). Takes ~3s per keyword due to Apple rate limits.",
      inputSchema: {},
    },
    async () => {
      const lines: string[] = [];
      await runSnapshot((l) => lines.push(l));
      return json({ log: lines });
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
