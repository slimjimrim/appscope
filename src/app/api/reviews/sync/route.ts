import { NextRequest, NextResponse } from "next/server";
import { syncReviews } from "@/lib/service";

export async function POST(req: NextRequest) {
  const { appId, countries } = await req.json();
  const result = await syncReviews(Number(appId), countries ?? ["us"]);
  return NextResponse.json(result);
}
