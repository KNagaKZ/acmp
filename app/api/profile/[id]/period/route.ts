import { NextRequest, NextResponse } from "next/server";
import { getPeriodAnalysis } from "@/lib/acmpHistory";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const from = request.nextUrl.searchParams.get("from") ?? ""; const to = request.nextUrl.searchParams.get("to") ?? "";
  try { return NextResponse.json(await getPeriodAnalysis(id, from, to)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not analyze this period." }, { status: 400 }); }
}
