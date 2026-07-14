import { NextRequest, NextResponse } from "next/server";
import { deleteSetting, setSetting } from "@/lib/service";

export async function POST(req: NextRequest) {
  const { key, value } = await req.json();
  if (value) await setSetting(key, value);
  else await deleteSetting(key);
  return NextResponse.json({ ok: true });
}
