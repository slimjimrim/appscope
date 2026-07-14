import { NextRequest, NextResponse } from "next/server";
import { addKeyword, checkKeyword, listKeywords } from "@/lib/service";

export async function GET(req: NextRequest) {
  const appId = req.nextUrl.searchParams.get("appId");
  const rows = await listKeywords(appId ? Number(appId) : undefined);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { appId, term, country } = await req.json();
  const terms: string[] = Array.isArray(term) ? term : [term];
  const created = [];
  for (const t of terms) {
    const row = await addKeyword(Number(appId), t, country ?? "us");
    if (row) {
      // Record an initial rank right away so the row isn't empty.
      await checkKeyword(row.id);
      created.push(row);
    }
  }
  return NextResponse.json({ ok: true, created });
}
