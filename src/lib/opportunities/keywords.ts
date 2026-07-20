import { and, eq } from "drizzle-orm";
import { db, tables } from "../db";
import {
  difficultyFromResults,
  expandKeyword,
  extractKeywords,
  searchApps,
} from "../appstore";
import { getAsaPopularityScores } from "../searchads/popularity";
import { OPP } from "./constants";

export type OpportunitySource =
  | "seed"
  | "seed-expansion"
  | "tracked-keyword"
  | "app-name"
  | "competitor-metadata";

export type KeywordFlag = "low-competition" | "ranking-gap" | "weak-incumbents";

export interface CandidateTerm {
  term: string;
  source: OpportunitySource;
}

/** Strip subtitle/suffix from an app name: "Driftwave: Sleep Sounds" → "driftwave". */
function cleanAppName(name: string): string {
  return name
    .toLowerCase()
    .split(/[:\-–—]/)[0]
    .trim();
}

/**
 * Build the candidate pool for one country: manual seeds and tracked keywords
 * first, then autocomplete expansions and competitor-metadata mining, capped
 * at OPP.MAX_CANDIDATES (each candidate costs a throttled search later).
 */
export async function discoverCandidateTerms(country: string): Promise<CandidateTerm[]> {
  const pool = new Map<string, OpportunitySource>();
  const add = (term: string, source: OpportunitySource) => {
    const t = term.trim().toLowerCase();
    if (t.length >= 2 && !pool.has(t)) pool.set(t, source);
  };
  const full = () => pool.size >= OPP.MAX_CANDIDATES;

  const seeds = await db.query.seedTerms.findMany({
    where: eq(tables.seedTerms.country, country),
  });
  for (const s of seeds) add(s.term, "seed");

  const apps = await db.query.trackedApps.findMany({
    where: eq(tables.trackedApps.country, country),
  });
  const tracked = apps.length
    ? await db.query.keywords.findMany({ where: eq(tables.keywords.country, country) })
    : [];
  for (const kw of tracked) add(kw.term, "tracked-keyword");

  for (const s of seeds) {
    if (full()) break;
    try {
      for (const t of await expandKeyword(s.term, country)) add(t, "seed-expansion");
    } catch {
      // autocomplete hiccups shouldn't kill discovery
    }
  }

  const names = [...new Set(apps.map((a) => cleanAppName(a.name)).filter(Boolean))];
  for (const name of names) {
    if (full()) break;
    add(name, "app-name");
    try {
      for (const t of await expandKeyword(name, country)) add(t, "app-name");
    } catch {
      /* ignore */
    }
  }

  for (const name of names) {
    if (full()) break;
    try {
      const top = await searchApps(name, country, 10);
      for (const k of extractKeywords(top, 15)) add(k.term, "competitor-metadata");
    } catch {
      /* ignore */
    }
  }

  return [...pool.entries()]
    .slice(0, OPP.MAX_CANDIDATES)
    .map(([term, source]) => ({ term, source }));
}

export interface OpportunityScanResult {
  scanned: number;
  flagged: number;
  needsLogin: boolean;
}

/**
 * Full keyword-opportunity scan for one country: batch ASA popularity, then
 * one search per candidate reused for difficulty, tracked-app rank, and
 * weak-incumbent stats. Replaces the country's keyword_opportunities rows.
 */
export async function runOpportunityScan(
  country: string,
  log: (line: string) => void = () => {},
): Promise<OpportunityScanResult> {
  const candidates = await discoverCandidateTerms(country);
  if (candidates.length === 0) {
    log(`opportunities · ${country}: no candidate terms (track an app or add seeds)`);
    return { scanned: 0, flagged: 0, needsLogin: false };
  }
  log(`opportunities · ${country}: scoring ${candidates.length} candidate terms`);

  // Batched ASA popularity — the dashboard endpoint rejects large batches
  // (50 fails, 25 works; verified 2026-07-20). Persist real scores to
  // keyword_popularity so history accrues.
  const scores = new Map<string, number>();
  let needsLogin = false;
  for (let i = 0; i < candidates.length; i += 25) {
    const chunk = candidates.slice(i, i + 25).map((c) => c.term);
    const res = await getAsaPopularityScores(chunk, country);
    needsLogin ||= res.needsLogin;
    if (res.scores) for (const [t, s] of res.scores) scores.set(t, s);
  }
  if (scores.size > 0) {
    await db.insert(tables.keywordPopularity).values(
      [...scores.entries()].map(([term, score]) => ({ term, country, score, source: "asa" })),
    );
  }
  if (needsLogin) log(`opportunities · ${country}: ASA session needs login — heuristic only`);

  const trackedAppIds = (
    await db.query.trackedApps.findMany({ where: eq(tables.trackedApps.country, country) })
  ).map((a) => a.appId);

  const rows: (typeof tables.keywordOpportunities.$inferInsert)[] = [];
  for (const { term, source } of candidates) {
    let results;
    try {
      results = await searchApps(term, country, 200);
    } catch (err) {
      log(`opportunities · "${term}" search failed: ${err}`);
      continue;
    }

    const diff = difficultyFromResults(results);
    const popularity = scores.get(term) ?? null;

    let bestRank: number | null = null;
    let bestRankAppId: number | null = null;
    for (const appId of trackedAppIds) {
      const idx = results.findIndex((a) => a.appId === appId);
      if (idx !== -1 && (bestRank == null || idx + 1 < bestRank)) {
        bestRank = idx + 1;
        bestRankAppId = appId;
      }
    }

    const weakCount = results
      .slice(0, 10)
      .filter(
        (a) =>
          (a.rating != null && a.rating < OPP.WEAK_AVG_RATING) ||
          (a.ratingCount ?? 0) < OPP.WEAK_MIN_RATING_COUNT,
      ).length;

    const flags: KeywordFlag[] = [];
    if (popularity != null && popularity >= OPP.MIN_POPULARITY && diff.score <= OPP.MAX_DIFFICULTY)
      flags.push("low-competition");
    if (
      trackedAppIds.length > 0 &&
      popularity != null &&
      popularity >= OPP.GAP_MIN_POPULARITY &&
      (bestRank == null || bestRank > OPP.GAP_RANK_THRESHOLD)
    )
      flags.push("ranking-gap");
    if (weakCount >= OPP.WEAK_TOP10_COUNT) flags.push("weak-incumbents");

    // Geometric mean rewards balanced demand/ease; without ASA, a dampened
    // ease-only score keeps heuristic rows below comparable ASA-scored ones.
    const opportunityScore =
      popularity != null
        ? Math.round(Math.sqrt(popularity * (100 - diff.score)))
        : Math.round((100 - diff.score) * 0.6);

    rows.push({
      term,
      country,
      source,
      popularity,
      difficulty: diff.score,
      opportunityScore,
      bestRank,
      bestRankAppId,
      top10Stats: {
        medianRatingCount: diff.medianRatingCount,
        avgRating: diff.avgRating,
        weakCount,
      },
      flags,
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(tables.keywordOpportunities)
      .where(and(eq(tables.keywordOpportunities.country, country)));
    if (rows.length > 0) await tx.insert(tables.keywordOpportunities).values(rows);
  });

  const flagged = rows.filter((r) => (r.flags as string[]).length > 0).length;
  log(`opportunities · ${country}: ${rows.length} scored, ${flagged} flagged`);
  return { scanned: rows.length, flagged, needsLogin };
}
