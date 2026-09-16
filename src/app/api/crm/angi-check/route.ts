import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Live Angi check is not on this branch. Stored has_angi_listing still filters and badges in CRM.",
    },
    { status: 501 },
  );
}
