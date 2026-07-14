import { cachedFetch, TTL } from "./client";
import type { ChartEntry } from "./types";

export type ChartType = "top-free" | "top-paid";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchTopChart(
  country = "us",
  chart: ChartType = "top-free",
  limit = 100,
): Promise<ChartEntry[]> {
  const url = `https://rss.marketingtools.apple.com/api/v2/${country}/apps/${chart}/${Math.min(limit, 200)}/apps.json`;
  const data = await cachedFetch<any>(url, { ttlMs: TTL.charts });
  const results: any[] = data?.feed?.results ?? [];
  return results.map((r, i) => ({
    rank: i + 1,
    appId: Number(r.id),
    name: r.name,
    developer: r.artistName ?? "",
    artworkUrl: r.artworkUrl100 ?? "",
    storeUrl: r.url ?? "",
  }));
}
