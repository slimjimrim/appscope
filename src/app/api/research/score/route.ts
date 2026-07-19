import { NextRequest, NextResponse } from "next/server";
import { keywordDifficulty } from "@/lib/appstore";
import { getAsaPopularityScores } from "@/lib/searchads";
import { db, tables } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const term = String(body.term);
  const country = body.country ?? "us";

  const [asa, difficulty] = await Promise.all([
    getAsaPopularityScores([term], country),
    keywordDifficulty(term, country),
  ]);
  const popularity = asa.scores?.get(term.toLowerCase()) ?? null;

  const rows = [{ term: term.toLowerCase(), country, score: difficulty.score, source: "heuristic" }];
  if (popularity != null) {
    rows.push({ term: term.toLowerCase(), country, score: popularity, source: "asa" });
  }
  await db.insert(tables.keywordPopularity).values(rows);

  return NextResponse.json({
    term,
    country,
    popularity,
    difficulty: difficulty.score,
    needsLogin: asa.needsLogin,
  });
}
