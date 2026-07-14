import { NextRequest, NextResponse } from "next/server";
import { checkKeyword } from "@/lib/service";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await checkKeyword(Number(id));
  return NextResponse.json(result);
}
