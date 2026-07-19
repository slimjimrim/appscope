import { NextResponse } from "next/server";
import { startLogin } from "@/lib/searchads/session";

// Runs the interactive login in this process (opens a headed browser window),
// non-blocking. The client polls GET /api/asa/status until connected.
export async function POST() {
  startLogin();
  return NextResponse.json({ ok: true, started: true });
}
