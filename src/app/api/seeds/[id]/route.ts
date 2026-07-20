import { NextRequest, NextResponse } from "next/server";
import { removeSeedTerm } from "@/lib/service";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await removeSeedTerm(Number(id));
  return NextResponse.json({ ok: true });
}
