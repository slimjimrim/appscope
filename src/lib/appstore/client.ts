import { eq } from "drizzle-orm";
import { db, tables } from "../db";

// Apple's iTunes endpoints have an undocumented soft limit around 20 req/min,
// so requests are serialized per host with a minimum spacing.
const HOST_INTERVAL_MS: Record<string, number> = {
  "itunes.apple.com": 3200,
};
const DEFAULT_INTERVAL_MS = 800;

const hostChains = new Map<string, Promise<void>>();
const hostLastRun = new Map<string, number>();

function throttled<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const interval = HOST_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS;
  const prev = hostChains.get(host) ?? Promise.resolve();
  const run = prev.then(async () => {
    const waitMs = (hostLastRun.get(host) ?? 0) + interval - Date.now();
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    hostLastRun.set(host, Date.now());
    return fn();
  });
  hostChains.set(
    host,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function fetchWithRetry(url: string, headers?: Record<string, string>): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers, redirect: "follow" });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

export interface CachedFetchOptions {
  /** How long a cached response stays fresh. */
  ttlMs: number;
  headers?: Record<string, string>;
  /** Set for non-JSON responses (e.g. the plist search-hints endpoint). */
  parseText?: (text: string) => unknown;
}

/**
 * Fetch a URL through the per-host throttle with a Postgres-backed TTL cache.
 * Cache key is the URL itself, so identical calls within the TTL are free.
 */
export async function cachedFetch<T>(url: string, opts: CachedFetchOptions): Promise<T> {
  const cached = await db.query.apiCache.findFirst({
    where: eq(tables.apiCache.cacheKey, url),
  });
  if (cached && Date.now() - cached.fetchedAt.getTime() < opts.ttlMs) {
    return cached.response as T;
  }

  const host = new URL(url).host;
  const data = await throttled(host, async () => {
    const res = await fetchWithRetry(url, opts.headers);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const text = await res.text();
    return opts.parseText ? opts.parseText(text) : JSON.parse(text);
  });

  await db
    .insert(tables.apiCache)
    .values({ cacheKey: url, response: data, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: tables.apiCache.cacheKey,
      set: { response: data, fetchedAt: new Date() },
    });

  return data as T;
}

export const TTL = {
  search: 6 * 60 * 60 * 1000, // 6h — search results move slowly
  lookup: 12 * 60 * 60 * 1000,
  reviews: 60 * 60 * 1000,
  charts: 6 * 60 * 60 * 1000,
  hints: 24 * 60 * 60 * 1000,
  none: 0,
} as const;
