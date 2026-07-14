const REVIEW_STOPWORDS = new Set(
  `a an and are as at be but by for from had has have i i'm i've if in into is it it's its just me my not of on or so that the them then there they this to too very was we were what when will with you your app apps really can cant can't dont don't do does did им это не на и в что с как`.split(
    /\s+/,
  ),
);

export interface WordFreq {
  term: string;
  count: number;
}

/** Most frequent words and bigrams across review titles+bodies. */
export function reviewWordFrequency(
  reviews: { title: string | null; body: string | null }[],
  max = 30,
): WordFreq[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const text = `${r.title ?? ""} ${r.body ?? ""}`.toLowerCase();
    const tokens = text
      .replace(/[^\p{L}\p{N}\s']/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !REVIEW_STOPWORDS.has(t));
    const seen = new Set<string>();
    for (let i = 0; i < tokens.length; i++) {
      // count each term once per review so one ranty review can't dominate
      if (!seen.has(tokens[i])) {
        seen.add(tokens[i]);
        counts.set(tokens[i], (counts.get(tokens[i]) ?? 0) + 1);
      }
      if (i < tokens.length - 1) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        if (!seen.has(bigram)) {
          seen.add(bigram);
          counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
        }
      }
    }
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .filter((w) => w.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}
