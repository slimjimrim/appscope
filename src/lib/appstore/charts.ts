import { cachedFetch, TTL } from "./client";
import type { ChartEntry } from "./types";

export type ChartType = "top-free" | "top-paid";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchTopChart(
  country = "us",
  chart: ChartType = "top-free",
  limit = 100,
  genreId?: number | null,
): Promise<ChartEntry[]> {
  if (genreId != null) return fetchGenreChart(country, chart, limit, genreId);
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
    releaseDate: null,
  }));
}

/**
 * Genre-scoped charts only exist on the legacy iTunes RSS feed — the
 * marketingtools v2 API has no genre parameter.
 */
async function fetchGenreChart(
  country: string,
  chart: ChartType,
  limit: number,
  genreId: number,
): Promise<ChartEntry[]> {
  const feed = chart === "top-paid" ? "toppaidapplications" : "topfreeapplications";
  const url =
    `https://itunes.apple.com/${country}/rss/${feed}` +
    `/limit=${Math.min(limit, 200)}/genre=${genreId}/json`;
  const data = await cachedFetch<any>(url, { ttlMs: TTL.charts });
  // Apple returns a bare object (not an array) when there is exactly one entry.
  const raw = data?.feed?.entry;
  const entries: any[] = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  return entries.map((e, i) => {
    const links = Array.isArray(e.link) ? e.link : [e.link];
    const images: any[] = e["im:image"] ?? [];
    return {
      rank: i + 1,
      appId: Number(e.id?.attributes?.["im:id"]),
      name: e["im:name"]?.label ?? "",
      developer: e["im:artist"]?.label ?? "",
      artworkUrl: images[images.length - 1]?.label ?? "",
      storeUrl: links[0]?.attributes?.href ?? "",
      releaseDate: e["im:releaseDate"]?.label ?? null,
    };
  });
}
