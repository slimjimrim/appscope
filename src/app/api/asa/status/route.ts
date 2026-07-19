import { NextResponse } from "next/server";
import { getSetting } from "@/lib/service";

export async function GET() {
  const mode = (process.env.ASA_SESSION_MODE ?? "playwright").toLowerCase();

  if (mode === "off") {
    return NextResponse.json({ mode, connecting: false, connected: false });
  }
  if (mode === "cookie") {
    const cookie = await getSetting("asa_session_cookie");
    return NextResponse.json({ mode, connecting: false, connected: Boolean(cookie) });
  }

  const { getSessionState } = await import("@/lib/searchads/session");
  const state = await getSessionState();
  return NextResponse.json({ mode, ...state });
}
