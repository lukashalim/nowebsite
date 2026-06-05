import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildFacebookListingSpintax,
  isEligibleForFacebookListingOutreach,
  shortenBusinessNameForOutreach,
  type FacebookOutreachRow,
} from "@/lib/outreach-spintax";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OutreachDbRow extends FacebookOutreachRow {
  main_category: string | null;
  business_type: string | null;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const placeId =
      typeof body === "object" &&
      body !== null &&
      "placeId" in body &&
      typeof (body as { placeId: unknown }).placeId === "string"
        ? (body as { placeId: string }).placeId.trim()
        : "";
    if (!placeId) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("businesses_nowebsite")
      .select(
        "place_id, name, facebook_url, crm_contact_surface, listing_website, main_category, business_type",
      )
      .eq("place_id", placeId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const outreachRow = row as OutreachDbRow;
    if (!isEligibleForFacebookListingOutreach(outreachRow)) {
      return NextResponse.json(
        {
          error:
            "This lead has no Facebook on their Google listing (or is WhatsApp-only). Spintax is only generated for Facebook-surface leads.",
        },
        { status: 400 },
      );
    }

    const fullName = outreachRow.name?.trim() ?? "";
    const shortName = shortenBusinessNameForOutreach(outreachRow.name);
    const spintax = buildFacebookListingSpintax({
      placeId: outreachRow.place_id,
      name: outreachRow.name,
      mainCategory: outreachRow.main_category,
      businessType: outreachRow.business_type,
    });

    return NextResponse.json({
      spintax,
      shortName,
      fullName: fullName || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
