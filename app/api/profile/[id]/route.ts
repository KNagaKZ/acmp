import { NextResponse } from "next/server";
import { AcmpProfileError, getAcmpProfile } from "@/lib/acmp";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    return NextResponse.json(await getAcmpProfile(id));
  } catch (error) {
    if (error instanceof AcmpProfileError) {
      const status = error.code === "INVALID_ID" ? 400 : error.code === "NOT_FOUND" ? 404 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Unexpected server error.", code: "INTERNAL" }, { status: 500 });
  }
}
