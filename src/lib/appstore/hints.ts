import { cachedFetch, TTL } from "./client";
import { storefrontHeader } from "./storefronts";

function parseHintsPlist(text: string): string[] {
  // The hints endpoint returns an XML plist; each suggestion is a
  // <key>term</key><string>…</string> pair.
  const terms: string[] = [];
  const re = /<key>term<\/key>\s*<string>([^<]+)<\/string>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) terms.push(m[1]);
  return terms;
}

/** App Store search autocomplete — the same suggestions users see while typing. */
export async function searchHints(term: string, country = "us"): Promise<string[]> {
  const url =
    `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints` +
    `?clientApplication=Software&term=${encodeURIComponent(term)}`;
  // Country determines the storefront header, so include it in the cache key
  // by appending a fragment (ignored by the server).
  const keyedUrl = `${url}#${country}`;
  return cachedFetch<string[]>(keyedUrl, {
    ttlMs: TTL.hints,
    headers: storefrontHeader(country),
    parseText: parseHintsPlist,
  });
}

/**
 * Expand a seed term one level: suggestions for the seed itself plus
 * suggestions for each first-level result.
 */
export async function expandKeyword(term: string, country = "us"): Promise<string[]> {
  const first = await searchHints(term, country);
  const seen = new Set<string>([term.toLowerCase(), ...first.map((t) => t.toLowerCase())]);
  const out = [...first];
  for (const t of first.slice(0, 5)) {
    const next = await searchHints(t, country);
    for (const n of next) {
      if (!seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        out.push(n);
      }
    }
  }
  return out;
}
