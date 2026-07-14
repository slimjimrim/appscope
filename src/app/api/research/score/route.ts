import { NextRequest, NextResponse } from "next/server";
import { getPopularity } from "@/lib/searchads";

export async function POST(req: NextRequest) {
  const { term, country } = await req.json();
  const [result] = await getPopularity([String(term)], country ?? "us");
  return NextResponse.json(result);
}
