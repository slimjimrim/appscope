import { NextRequest, NextResponse } from "next/server";
import { addSeedTerms, listSeedTerms } from "@/lib/service";

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? undefined;
  const rows = await listSeedTerms(country);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { terms, country } = await req.json();
  const list: string[] = Array.isArray(terms) ? terms : [terms];
  const created = await addSeedTerms(list, country ?? "us");
  return NextResponse.json({ ok: true, created });
}
