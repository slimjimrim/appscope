import { NextRequest, NextResponse } from "next/server";
import { trackApp, untrackApp } from "@/lib/service";

export async function POST(req: NextRequest) {
  const { appId, country } = await req.json();
  const app = await trackApp(Number(appId), country ?? "us");
  return NextResponse.json({ ok: true, app });
}

export async function DELETE(req: NextRequest) {
  const appId = Number(req.nextUrl.searchParams.get("appId"));
  await untrackApp(appId);
  return NextResponse.json({ ok: true });
}
