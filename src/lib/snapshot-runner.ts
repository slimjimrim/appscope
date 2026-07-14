import { eq } from "drizzle-orm";
import { db, tables } from "./db";
import {
  checkKeyword,
  listTrackedApps,
  recordChartSnapshot,
  recordRatingSnapshot,
  syncReviews,
} from "./service";

/**
 * One full snapshot pass over every tracked app: keyword ranks, current
 * rating, new reviews, and top-chart captures. Shared by the CLI script,
 * the MCP server, and anything else that wants a refresh.
 */
export async function runSnapshot(log: (line: string) => void = () => {}) {
  const startedAt = Date.now();
  const apps = await listTrackedApps();
  log(`${apps.length} tracked app(s)`);

  for (const app of apps) {
    const keywords = await db.query.keywords.findMany({
      where: eq(tables.keywords.appId, app.appId),
    });

    for (const kw of keywords) {
      try {
        const r = await checkKeyword(kw.id);
        log(`${app.name} · "${kw.term}" (${kw.country}) → ${r.rank ?? ">200"}`);
      } catch (err) {
        log(`${app.name} · "${kw.term}" failed: ${err}`);
      }
    }

    try {
      const rating = await recordRatingSnapshot(app.appId, app.country);
      log(`${app.name} · rating ${rating?.rating} (${rating?.ratingCount} ratings)`);
    } catch (err) {
      log(`${app.name} · rating snapshot failed: ${err}`);
    }

    try {
      const { inserted } = await syncReviews(app.appId, [app.country]);
      log(`${app.name} · +${inserted} new reviews`);
    } catch (err) {
      log(`${app.name} · review sync failed: ${err}`);
    }
  }

  const countries = [...new Set(apps.map((a) => a.country))];
  for (const country of countries.length ? countries : ["us"]) {
    for (const chart of ["top-free", "top-paid"] as const) {
      try {
        const { count } = await recordChartSnapshot(country, chart);
        log(`charts · ${country}/${chart}: ${count} entries`);
      } catch (err) {
        log(`charts · ${country}/${chart} failed: ${err}`);
      }
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(0);
  log(`done in ${seconds}s`);
  return { apps: apps.length, seconds: Number(seconds) };
}
