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
  // Sorted ids keep the cache key stable across minor reorderings (e.g. chart
  // reshuffles); the lookup endpoint caps at ~200 ids per request.
  const sorted = [...new Set(appIds)].sort((a, b) => a - b);
  const out: AppSummary[] = [];
  for (let i = 0; i < sorted.length; i += 200) {
    const chunk = sorted.slice(i, i + 200);
    const url = `https://itunes.apple.com/lookup?id=${chunk.join(",")}&country=${country}&entity=software`;
    const data = await cachedFetch<ItunesResponse>(url, { ttlMs: TTL.lookup });
    out.push(
      ...data.results
        .filter((r) => (r as { kind?: string }).kind === "software")
        .map(mapItunesResult),
    );
  }
  return out;
}

export async function lookupApp(appId: number, country = "us"): Promise<AppSummary | null> {
  const results = await lookupApps([appId], country);
  return results[0] ?? null;
}
