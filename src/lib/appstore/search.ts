import { cachedFetch, TTL } from "./client";
import { mapItunesResult, type AppSummary } from "./types";

interface ItunesResponse {
  resultCount: number;
  results: unknown[];
}

export async function searchApps(
  term: string,
  country = "us",
  limit = 50,
): Promise<AppSummary[]> {
  const url =
    `https://itunes.apple.com/search?media=software&entity=software` +
    `&term=${encodeURIComponent(term)}&country=${country}&limit=${Math.min(limit, 200)}`;
  const data = await cachedFetch<ItunesResponse>(url, { ttlMs: TTL.search });
  return data.results.map(mapItunesResult);
}

export async function lookupApps(appIds: number[], country = "us"): Promise<AppSummary[]> {
  if (appIds.length === 0) return [];
  const url = `https://itunes.apple.com/lookup?id=${appIds.join(",")}&country=${country}&entity=software`;
  const data = await cachedFetch<ItunesResponse>(url, { ttlMs: TTL.lookup });
  return data.results
    .filter((r) => (r as { kind?: string }).kind === "software")
    .map(mapItunesResult);
}

export async function lookupApp(appId: number, country = "us"): Promise<AppSummary | null> {
  const results = await lookupApps([appId], country);
  return results[0] ?? null;
}
