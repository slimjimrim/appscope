import { db, tables } from "../db";
import { keywordDifficulty } from "../appstore/keywords";
import { getSetting, setSetting } from "../service";

export interface PopularityResult {
  term: string;
  country: string;
  score: number;
  /** "asa" = Apple Search Ads popularity (5–100); "heuristic" = our difficulty estimate (0–100). */
  source: "asa" | "heuristic";
}

export interface PopularityResponse {
  results: PopularityResult[];
  /** True when the Apple Ads session needs an interactive re-login (`npm run asa:login`). */
  needsLogin: boolean;
}

/**
 * Apple's keyword popularity score (5–100) comes from the Apple Ads dashboard
 * (app-ads.apple.com), not the official Campaign Management API (that endpoint
 * is internal-only — verified 2026-07-14). Two ways to reach it:
 *
 *   ASA_SESSION_MODE=playwright (default) — run the request inside a persistent
 *     logged-in browser (src/lib/searchads/session.ts). Sign in once via
 *     `npm run asa:login`; it self-maintains.
 *   ASA_SESSION_MODE=cookie — legacy manual path: paste the dashboard Cookie
 *     header into Settings ("asa_session_cookie").
 *   ASA_SESSION_MODE=off — always use the local difficulty heuristic.
 *
 * Either way, results fall back to the difficulty heuristic per-term when ASA
 * has no score, and every result is persisted to keyword_popularity.
 */

const DASH_BASE = "https://app-ads.apple.com/cm/api";

function sessionMode(): "playwright" | "cookie" | "off" {
  const m = process.env.ASA_SESSION_MODE?.toLowerCase();
  if (m === "cookie" || m === "off") return m;
  return "playwright";
}

// ---- legacy cookie path (kept for ASA_SESSION_MODE=cookie) ----

function dashHeaders(cookie: string): Record<string, string> {
  return {
    Cookie: cookie,
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: "https://app-ads.apple.com",
    Referer: "https://app-ads.apple.com/cm/dashboard",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  };
}

async function getOwnedAdamIdViaCookie(cookie: string): Promise<string | null> {
  const cached = await getSetting("asa_adam_id");
  if (cached) return cached;
  try {
    const res = await fetch(`${DASH_BASE}/v1/apps?ownedApps=true`, { headers: dashHeaders(cookie) });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { adamId?: string }[] };
    const adamId = json.data?.[0]?.adamId;
    if (adamId) await setSetting("asa_adam_id", String(adamId));
    return adamId ? String(adamId) : null;
  } catch {
    return null;
  }
}

async function fetchViaCookie(terms: string[], country: string): Promise<Map<string, number> | null> {
  const cookie = await getSetting("asa_session_cookie");
  if (!cookie) return null;
  const adamId = await getOwnedAdamIdViaCookie(cookie);
  if (!adamId) return null;
  try {
    const res = await fetch(`${DASH_BASE}/v2/keywords/popularities?adamId=${adamId}`, {
      method: "POST",
      headers: dashHeaders(cookie),
      body: JSON.stringify({ storefronts: [country.toUpperCase()], terms }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { name?: string; popularity?: number }[] };
    const map = new Map<string, number>();
    for (const row of json.data ?? []) {
      if (row.name && row.popularity != null) map.set(row.name.toLowerCase(), row.popularity);
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

/** Resolve ASA popularity scores for terms; returns null map + needsLogin signal. */
export async function getAsaPopularityScores(
  terms: string[],
  country: string,
): Promise<{ scores: Map<string, number> | null; needsLogin: boolean }> {
  const mode = sessionMode();
  if (mode === "off") return { scores: null, needsLogin: false };
  if (mode === "cookie") return { scores: await fetchViaCookie(terms, country), needsLogin: false };

  // Lazy-load the Playwright session module so it (and Chromium) only loads when used.
  const { fetchPopularityViaSession } = await import("./session");
  const res = await fetchPopularityViaSession(terms, country);
  if (res.ok) return { scores: res.scores, needsLogin: false };
  return { scores: null, needsLogin: res.reason === "needs_login" };
}

export async function getPopularityDetailed(
  terms: string[],
  country = "us",
): Promise<PopularityResponse> {
  const { scores, needsLogin } = await getAsaPopularityScores(terms, country);
  const results: PopularityResult[] = [];

  for (const term of terms) {
    const asaScore = scores?.get(term.toLowerCase());
    if (asaScore != null) {
      results.push({ term, country, score: asaScore, source: "asa" });
    } else {
      const diff = await keywordDifficulty(term, country);
      results.push({ term, country, score: diff.score, source: "heuristic" });
    }
  }

  if (results.length > 0) {
    await db.insert(tables.keywordPopularity).values(
      results.map((r) => ({
        term: r.term.toLowerCase(),
        country: r.country,
        score: r.score,
        source: r.source,
      })),
    );
  }
  return { results, needsLogin };
}

/** Back-compat: returns just the results array (used by the MCP server). */
export async function getPopularity(terms: string[], country = "us"): Promise<PopularityResult[]> {
  return (await getPopularityDetailed(terms, country)).results;
}
