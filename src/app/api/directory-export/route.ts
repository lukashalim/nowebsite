import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Full directory CSV export is not available" },
    { status: 403 },
  );
}
