import { searchApps } from "./search";
import type { AppSummary } from "./types";

export interface KeywordRankResult {
  term: string;
  country: string;
  appId: number;
  /** 1-based position in search results, or null if not in top 200. */
  rank: number | null;
  totalResults: number;
  top10: Pick<AppSummary, "appId" | "name" | "developer" | "rating" | "ratingCount">[];
}

export async function getKeywordRank(
  term: string,
  country: string,
  appId: number,
): Promise<KeywordRankResult> {
  const results = await searchApps(term, country, 200);
  const idx = results.findIndex((a) => a.appId === appId);
  return {
    term,
    country,
    appId,
    rank: idx === -1 ? null : idx + 1,
    totalResults: results.length,
    top10: results.slice(0, 10).map((a) => ({
      appId: a.appId,
      name: a.name,
      developer: a.developer,
      rating: a.rating,
      ratingCount: a.ratingCount,
    })),
  };
}

const STOPWORDS = new Set(
  `a an and are as at be by for from has have in into is it its of on or that the this to was were will with you your app apps free best new get more all can & - – — + your our my we us`.split(
    /\s+/,
  ),
);

export interface ExtractedKeyword {
  term: string;
  count: number;
  apps: string[];
}

/**
 * Extract candidate keywords from competitor metadata: tokenize names and
 * descriptions of the given apps and rank tokens/bigrams by how many distinct
 * apps use them.
 */
export function extractKeywords(apps: AppSummary[], max = 40): ExtractedKeyword[] {
  const byTerm = new Map<string, Set<string>>();

  const add = (term: string, app: string) => {
    if (term.length < 3 || STOPWORDS.has(term)) return;
    if (!byTerm.has(term)) byTerm.set(term, new Set());
    byTerm.get(term)!.add(app);
  };

  for (const app of apps) {
    // Name carries the strongest ASO signal; use the first paragraph of the
    // description as a weaker secondary source.
    const name = app.name.toLowerCase();
    const descFirstPara = app.description.split("\n")[0]?.toLowerCase() ?? "";
    for (const source of [name, name, descFirstPara]) {
      const tokens = source
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(Boolean);
      tokens.forEach((t) => add(t, app.name));
      for (let i = 0; i < tokens.length - 1; i++) {
        if (STOPWORDS.has(tokens[i]) || STOPWORDS.has(tokens[i + 1])) continue;
        add(`${tokens[i]} ${tokens[i + 1]}`, app.name);
      }
    }
  }

  return [...byTerm.entries()]
    .map(([term, apps]) => ({ term, count: apps.size, apps: [...apps] }))
    .filter((k) => k.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

export interface DifficultyResult {
  term: string;
  country: string;
  /** 0–100; higher = harder to rank. */
  score: number;
  medianRatingCount: number;
  avgRating: number;
  totalResults: number;
}

/**
 * Difficulty heuristic from a search-result set: how entrenched are the
 * current top 10? Based on the median rating count (log scale — 1M-review
 * incumbents ≈ 100) blended with their average star rating.
 */
export function difficultyFromResults(
  results: AppSummary[],
): Omit<DifficultyResult, "term" | "country"> {
  const top10 = results.slice(0, 10);
  const counts = top10.map((a) => a.ratingCount ?? 0).sort((x, y) => x - y);
  const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
  const rated = top10.filter((a) => a.rating != null);
  const avgRating = rated.length
    ? rated.reduce((s, a) => s + (a.rating ?? 0), 0) / rated.length
    : 0;

  // log10(1e6) = 6 → saturates at 100 for million-review incumbents
  const volumeScore = Math.min(100, (Math.log10(median + 1) / 6) * 100);
  const qualityScore = (avgRating / 5) * 100;
  const score = Math.round(volumeScore * 0.75 + qualityScore * 0.25);

  return {
    score,
    medianRatingCount: median,
    avgRating: Number(avgRating.toFixed(2)),
    totalResults: results.length,
  };
}

export async function keywordDifficulty(term: string, country = "us"): Promise<DifficultyResult> {
  const results = await searchApps(term, country, 50);
  return { term, country, ...difficultyFromResults(results) };
}
