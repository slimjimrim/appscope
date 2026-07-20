import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { db, tables } from "./db";
import {
  fetchReviews,
  fetchTopChart,
  getKeywordRank,
  lookupApp,
  type ChartType,
} from "./appstore";

// ---------- tracked apps ----------

export async function listTrackedApps() {
  return db.query.trackedApps.findMany({
    orderBy: (t, { asc }) => [asc(t.addedAt)],
  });
}

export async function trackApp(appId: number, country = "us") {
  const app = await lookupApp(appId, country);
  if (!app) throw new Error(`App ${appId} not found in ${country} store`);
  await db
    .insert(tables.trackedApps)
    .values({
      appId: app.appId,
      name: app.name,
      country,
      bundleId: app.bundleId,
      developer: app.developer,
      artworkUrl: app.artworkUrl,
      metadata: app,
    })
    .onConflictDoUpdate({
      target: tables.trackedApps.appId,
      set: { name: app.name, artworkUrl: app.artworkUrl, metadata: app },
    });
  return app;
}

export async function untrackApp(appId: number) {
  await db.delete(tables.trackedApps).where(eq(tables.trackedApps.appId, appId));
}

// ---------- keywords ----------

export async function listKeywords(appId?: number) {
  const rows = await db.query.keywords.findMany({
    where: appId ? eq(tables.keywords.appId, appId) : undefined,
    orderBy: (t, { asc }) => [asc(t.appId), asc(t.term)],
  });
  if (rows.length === 0) return [];

  const latest = await db
    .select({
      keywordId: tables.keywordRanks.keywordId,
      rank: tables.keywordRanks.rank,
      snapshotAt: tables.keywordRanks.snapshotAt,
    })
    .from(tables.keywordRanks)
    .where(inArray(tables.keywordRanks.keywordId, rows.map((r) => r.id)))
    .orderBy(desc(tables.keywordRanks.snapshotAt));

  const latestByKeyword = new Map<number, { rank: number | null; snapshotAt: Date }>();
  const previousByKeyword = new Map<number, number | null>();
  for (const s of latest) {
    if (!latestByKeyword.has(s.keywordId)) {
      latestByKeyword.set(s.keywordId, { rank: s.rank, snapshotAt: s.snapshotAt });
    } else if (!previousByKeyword.has(s.keywordId)) {
      previousByKeyword.set(s.keywordId, s.rank);
    }
  }

  return rows.map((r) => ({
    ...r,
    latestRank: latestByKeyword.get(r.id)?.rank ?? null,
    latestCheckedAt: latestByKeyword.get(r.id)?.snapshotAt ?? null,
    previousRank: previousByKeyword.get(r.id) ?? null,
  }));
}

export async function addKeyword(appId: number, term: string, country = "us") {
  const [row] = await db
    .insert(tables.keywords)
    .values({ appId, term: term.trim().toLowerCase(), country })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function removeKeyword(id: number) {
  await db.delete(tables.keywords).where(eq(tables.keywords.id, id));
}

/** Compute the current rank for one keyword and store a snapshot. */
export async function checkKeyword(keywordId: number) {
  const kw = await db.query.keywords.findFirst({ where: eq(tables.keywords.id, keywordId) });
  if (!kw) throw new Error(`Keyword ${keywordId} not found`);
  const result = await getKeywordRank(kw.term, kw.country, kw.appId);
  await db.insert(tables.keywordRanks).values({
    keywordId,
    rank: result.rank,
    totalResults: result.totalResults,
    topResults: result.top10,
  });
  return { ...kw, ...result };
}

export async function keywordRankHistory(keywordId: number, days = 90) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  return db
    .select({
      rank: tables.keywordRanks.rank,
      snapshotAt: tables.keywordRanks.snapshotAt,
    })
    .from(tables.keywordRanks)
    .where(
      and(
        eq(tables.keywordRanks.keywordId, keywordId),
        gte(tables.keywordRanks.snapshotAt, since),
      ),
    )
    .orderBy(tables.keywordRanks.snapshotAt);
}

// ---------- reviews ----------

export async function syncReviews(appId: number, countries: string[] = ["us"]) {
  let inserted = 0;
  for (const country of countries) {
    const fetched = await fetchReviews(appId, country);
    for (const r of fetched) {
      const res = await db
        .insert(tables.reviews)
        .values({
          appId,
          country,
          reviewId: r.reviewId,
          rating: r.rating,
          title: r.title,
          body: r.body,
          version: r.version,
          author: r.author,
          reviewedAt: r.updatedAt ? new Date(r.updatedAt) : null,
        })
        .onConflictDoNothing()
        .returning({ id: tables.reviews.id });
      inserted += res.length;
    }
  }
  return { inserted };
}

export interface ReviewFilters {
  appId: number;
  country?: string;
  rating?: number;
  version?: string;
  search?: string;
  since?: Date;
  limit?: number;
  offset?: number;
}

export async function queryReviews(f: ReviewFilters) {
  const conds = [eq(tables.reviews.appId, f.appId)];
  if (f.country) conds.push(eq(tables.reviews.country, f.country));
  if (f.rating) conds.push(eq(tables.reviews.rating, f.rating));
  if (f.version) conds.push(eq(tables.reviews.version, f.version));
  if (f.since) conds.push(gte(tables.reviews.reviewedAt, f.since));
  if (f.search) {
    conds.push(
      or(ilike(tables.reviews.title, `%${f.search}%`), ilike(tables.reviews.body, `%${f.search}%`))!,
    );
  }
  return db.query.reviews.findMany({
    where: and(...conds),
    orderBy: (t, { desc }) => [desc(t.reviewedAt)],
    limit: f.limit ?? 100,
    offset: f.offset ?? 0,
  });
}

export async function reviewStats(appId: number, country?: string) {
  const conds = [eq(tables.reviews.appId, appId)];
  if (country) conds.push(eq(tables.reviews.country, country));
  const rows = await db
    .select({
      rating: tables.reviews.rating,
      count: sql<number>`count(*)::int`,
    })
    .from(tables.reviews)
    .where(and(...conds))
    .groupBy(tables.reviews.rating);
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of rows) {
    dist[r.rating] = r.count;
    total += r.count;
  }
  return { total, distribution: dist };
}

// ---------- snapshots ----------

export async function recordRatingSnapshot(appId: number, country = "us") {
  const app = await lookupApp(appId, country);
  if (!app) return null;
  await db.insert(tables.ratingSnapshots).values({
    appId,
    country,
    avgRating: app.rating,
    ratingCount: app.ratingCount,
  });
  return { rating: app.rating, ratingCount: app.ratingCount };
}

export async function recordChartSnapshot(
  country = "us",
  chart: ChartType = "top-free",
  genreId?: number | null,
) {
  const entries = await fetchTopChart(country, chart, 100, genreId);
  if (entries.length === 0) return { count: 0 };
  await db.insert(tables.chartSnapshots).values(
    entries.map((e) => ({
      country,
      chartType: chart,
      genreId: genreId ?? null,
      rank: e.rank,
      appId: e.appId,
      appName: e.name,
    })),
  );
  return { count: entries.length };
}

export async function ratingHistory(appId: number, country = "us", days = 180) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  return db
    .select({
      avgRating: tables.ratingSnapshots.avgRating,
      ratingCount: tables.ratingSnapshots.ratingCount,
      snapshotAt: tables.ratingSnapshots.snapshotAt,
    })
    .from(tables.ratingSnapshots)
    .where(
      and(
        eq(tables.ratingSnapshots.appId, appId),
        eq(tables.ratingSnapshots.country, country),
        gte(tables.ratingSnapshots.snapshotAt, since),
      ),
    )
    .orderBy(tables.ratingSnapshots.snapshotAt);
}

// ---------- seed terms & keyword opportunities ----------

export async function listSeedTerms(country?: string) {
  return db.query.seedTerms.findMany({
    where: country ? eq(tables.seedTerms.country, country) : undefined,
    orderBy: (t, { asc }) => [asc(t.term)],
  });
}

export async function addSeedTerms(terms: string[], country = "us") {
  const values = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))].map(
    (term) => ({ term, country }),
  );
  if (values.length === 0) return [];
  return db.insert(tables.seedTerms).values(values).onConflictDoNothing().returning();
}

export async function removeSeedTerm(id: number) {
  await db.delete(tables.seedTerms).where(eq(tables.seedTerms.id, id));
}

export interface OpportunityFilters {
  country?: string;
  minPopularity?: number;
  maxDifficulty?: number;
  /** Keep only rows carrying at least one of these flags. */
  flags?: string[];
  limit?: number;
}

export async function listKeywordOpportunities(f: OpportunityFilters = {}) {
  const rows = await db.query.keywordOpportunities.findMany({
    where: eq(tables.keywordOpportunities.country, f.country ?? "us"),
    orderBy: (t, { desc }) => [desc(t.opportunityScore)],
  });
  // At most MAX_CANDIDATES rows per country, so filter in JS.
  return rows
    .filter((r) => f.minPopularity == null || (r.popularity ?? 0) >= f.minPopularity)
    .filter((r) => f.maxDifficulty == null || r.difficulty <= f.maxDifficulty)
    .filter(
      (r) =>
        !f.flags?.length || (r.flags as string[]).some((flag) => f.flags!.includes(flag)),
    )
    .slice(0, f.limit ?? 100);
}

// ---------- settings ----------

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(tables.settings.key, key) });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(tables.settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: tables.settings.key, set: { value, updatedAt: new Date() } });
}

export async function deleteSetting(key: string) {
  await db.delete(tables.settings).where(eq(tables.settings.key, key));
}

/** Genre ids captured by the daily chart snapshot (JSON array in settings). */
export async function getSnapshotGenres(): Promise<number[]> {
  const raw = await getSetting("snapshot_genres");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export async function setSnapshotGenres(genreIds: number[]) {
  await setSetting("snapshot_genres", JSON.stringify([...new Set(genreIds)].sort((a, b) => a - b)));
}
