import { NextRequest, NextResponse } from "next/server";
import { keywordRankHistory } from "@/lib/service";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const days = Number(req.nextUrl.searchParams.get("days") ?? 90);
  const rows = await keywordRankHistory(Number(id), days);
  return NextResponse.json(rows);
}
