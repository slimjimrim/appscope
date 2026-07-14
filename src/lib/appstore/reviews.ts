import { cachedFetch, TTL } from "./client";
import type { AppReview } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEntry(e: any, country: string): AppReview {
  return {
    reviewId: e.id?.label ?? "",
    rating: Number(e["im:rating"]?.label ?? 0),
    title: e.title?.label ?? "",
    body: e.content?.label ?? "",
    version: e["im:version"]?.label ?? "",
    author: e.author?.name?.label ?? "",
    updatedAt: e.updated?.label ?? "",
    country,
  };
}

/**
 * Fetch recent reviews from the public RSS feed. Apple serves at most
 * 10 pages × ~50 reviews per app per country.
 */
export async function fetchReviews(
  appId: number,
  country = "us",
  maxPages = 10,
): Promise<AppReview[]> {
  const all: AppReview[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`;
    let data: any;
    try {
      data = await cachedFetch<any>(url, { ttlMs: TTL.reviews });
    } catch {
      break; // pages past the end can 40x
    }
    const entries = data?.feed?.entry;
    if (!entries) break;
    const list = Array.isArray(entries) ? entries : [entries];
    const mapped = list.map((e) => mapEntry(e, country)).filter((r) => r.reviewId);
    all.push(...mapped);
    if (list.length < 50) break;
  }
  return all;
}
