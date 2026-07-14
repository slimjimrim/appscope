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

/**
 * Apple's keyword popularity score (5–100) is served by the Apple Ads
 * dashboard's internal API (app-ads.apple.com), not the official Campaign
 * Management API. It requires a logged-in dashboard session: paste the Cookie
 * header from a request on app-ads.apple.com into Settings
 * ("asa_session_cookie").
 *
 * Endpoint (verified 2026-07-13):
 *   POST https://app-ads.apple.com/cm/api/v2/keywords/popularities?adamId=<owned app>
 *   body {"storefronts":["US"],"terms":[...]} → {"data":[{"name","popularity"}]}
 * The adamId must be an app the account owns; it's auto-discovered from
 * /cm/api/v1/apps?ownedApps=true and cached in settings ("asa_adam_id").
 * Any failure falls back to the local difficulty heuristic.
 */

const DASH_BASE = "https://app-ads.apple.com/cm/api";

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

async function getOwnedAdamId(cookie: string): Promise<string | null> {
  const cached = await getSetting("asa_adam_id");
  if (cached) return cached;
  try {
    const res = await fetch(`${DASH_BASE}/v1/apps?ownedApps=true`, {
      headers: dashHeaders(cookie),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { adamId?: string }[] };
    const adamId = json.data?.[0]?.adamId;
    if (adamId) {
      await setSetting("asa_adam_id", String(adamId));
      return String(adamId);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAsaPopularity(
  terms: string[],
  country: string,
): Promise<Map<string, number> | null> {
  const cookie = await getSetting("asa_session_cookie");
  if (!cookie) return null;
  const adamId = await getOwnedAdamId(cookie);
  if (!adamId) return null;

  try {
    const res = await fetch(`${DASH_BASE}/v2/keywords/popularities?adamId=${adamId}`, {
      method: "POST",
      headers: dashHeaders(cookie),
      body: JSON.stringify({ storefronts: [country.toUpperCase()], terms }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { name?: string; popularity?: number }[];
    };
    const map = new Map<string, number>();
    for (const row of json.data ?? []) {
      if (row.name && row.popularity != null) map.set(row.name.toLowerCase(), row.popularity);
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

export async function getPopularity(terms: string[], country = "us"): Promise<PopularityResult[]> {
  const asa = await fetchAsaPopularity(terms, country);
  const results: PopularityResult[] = [];

  for (const term of terms) {
    const asaScore = asa?.get(term.toLowerCase());
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
  return results;
}
