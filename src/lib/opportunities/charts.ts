import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { db, tables } from "../db";
import { fetchTopChart, lookupApps, type ChartEntry, type ChartType } from "../appstore";
import { OPP } from "./constants";

export type ChartFlag = "weak-incumbent" | "fast-climber" | "new-entrant";

export interface EnrichedChartEntry extends ChartEntry {
  rating: number | null;
  ratingCount: number | null;
  releaseDate: string | null;
  /** Rank in the baseline snapshot (~7 days ago); null = not charted then. */
  previousRank: number | null;
  /** Positive = climbed since the baseline. */
  delta: number | null;
  flags: ChartFlag[];
}

export interface ChartOpportunities {
  entries: EnrichedChartEntry[];
  /** When the fast-climber baseline was taken; null = not enough history yet. */
  baselineAt: Date | null;
}

/**
 * Find the snapshot batch to diff against: the newest one at least ~7 days
 * old, else the oldest one at least a day old (early-history fallback).
 */
async function findBaseline(country: string, chart: ChartType, genreId: number | null) {
  const scope = and(
    eq(tables.chartSnapshots.country, country),
    eq(tables.chartSnapshots.chartType, chart),
    genreId == null
      ? isNull(tables.chartSnapshots.genreId)
      : eq(tables.chartSnapshots.genreId, genreId),
  );
  const windowStart = new Date(
    Date.now() - (OPP.FAST_CLIMBER_WINDOW_DAYS - 0.5) * 24 * 3600 * 1000,
  );
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  let [row] = await db
    .select({ snapshotAt: tables.chartSnapshots.snapshotAt })
    .from(tables.chartSnapshots)
    .where(and(scope, lte(tables.chartSnapshots.snapshotAt, windowStart)))
    .orderBy(desc(tables.chartSnapshots.snapshotAt))
    .limit(1);
  if (!row) {
    [row] = await db
      .select({ snapshotAt: tables.chartSnapshots.snapshotAt })
      .from(tables.chartSnapshots)
      .where(and(scope, lte(tables.chartSnapshots.snapshotAt, oneDayAgo)))
      .orderBy(asc(tables.chartSnapshots.snapshotAt))
      .limit(1);
  }
  if (!row) return { baselineAt: null, ranks: new Map<number, number>() };

  const rows = await db
    .select({ appId: tables.chartSnapshots.appId, rank: tables.chartSnapshots.rank })
    .from(tables.chartSnapshots)
    .where(and(scope, eq(tables.chartSnapshots.snapshotAt, row.snapshotAt)));
  const ranks = new Map<number, number>();
  for (const r of rows) {
    const prev = ranks.get(r.appId);
    if (prev == null || r.rank < prev) ranks.set(r.appId, r.rank);
  }
  return { baselineAt: row.snapshotAt, ranks };
}

/**
 * Live top chart (optionally genre-scoped) enriched with ratings and
 * opportunity flags. Cold cost: 1 chart fetch + 1 batched lookup, both
 * throttled + cached (6–12h) — reloads within the TTL are free.
 */
export async function getChartOpportunities(
  country: string,
  chart: ChartType,
  genreId: number | null,
  limit = 100,
): Promise<ChartOpportunities> {
  const chartEntries = await fetchTopChart(country, chart, limit, genreId);
  const [apps, baseline] = await Promise.all([
    lookupApps(chartEntries.map((e) => e.appId), country),
    findBaseline(country, chart, genreId),
  ]);
  const byId = new Map(apps.map((a) => [a.appId, a]));
  const newEntrantCutoff = Date.now() - OPP.NEW_ENTRANT_DAYS * 24 * 3600 * 1000;

  const entries = chartEntries.map((e): EnrichedChartEntry => {
    const app = byId.get(e.appId);
    const rating = app?.rating ?? null;
    const ratingCount = app?.ratingCount ?? null;
    const releaseDate = app?.releaseDate ?? e.releaseDate ?? null;
    const previousRank = baseline.ranks.get(e.appId) ?? null;
    const delta = previousRank == null ? null : previousRank - e.rank;

    const flags: ChartFlag[] = [];
    if (
      rating != null &&
      rating < OPP.WEAK_AVG_RATING &&
      (ratingCount ?? 0) >= OPP.WEAK_MIN_RATING_COUNT
    )
      flags.push("weak-incumbent");
    if (delta != null && delta >= OPP.FAST_CLIMBER_POSITIONS) flags.push("fast-climber");
    if (
      releaseDate != null &&
      new Date(releaseDate).getTime() >= newEntrantCutoff &&
      e.rank <= OPP.NEW_ENTRANT_MAX_RANK
    )
      flags.push("new-entrant");

    return { ...e, rating, ratingCount, releaseDate, previousRank, delta, flags };
  });

  return { entries, baselineAt: baseline.baselineAt };
}
