import { NextResponse } from "next/server";
import { upsertCrmUserContact, fetchCrmUserContact } from "@/app/actions/crm-user-contact";
import {
  detectAngiListingForBusiness,
  parseAngiCompetitorsJson,
  resolveDataForSeoCredentials,
} from "@/lib/angi-listing";
import {
  categorySlugsForGroup,
  fetchCategoryGroupTaxonomy,
} from "@/lib/directory/category-groups";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { placeId?: string };
  try {
    body = (await request.json()) as { placeId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const placeId = body.placeId?.trim() ?? "";
  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const credentials = resolveDataForSeoCredentials();
  if (!credentials) {
    return NextResponse.json(
      {
        error:
          "DataForSEO credentials are not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).",
      },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdmin();
  const { data: row, error: fetchError } = await admin
    .from("businesses_nowebsite")
    .select(
      "place_id, name, address, city, state, phone, country, main_category, business_type, directory_category_slug",
    )
    .eq("place_id", placeId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const taxonomy = await fetchCategoryGroupTaxonomy();
  const homeSlugs = new Set(
    categorySlugsForGroup("home-services", taxonomy).map((s) =>
      s.toLowerCase(),
    ),
  );
  const slug = String(row.directory_category_slug ?? "")
    .trim()
    .toLowerCase();
  if (!slug || !homeSlugs.has(slug)) {
    return NextResponse.json(
      { error: "Angi check is only available for home-services leads." },
      { status: 400 },
    );
  }

  if (!row.name?.trim() || (!row.city?.trim() && !row.state?.trim())) {
    return NextResponse.json(
      {
        error:
          "Angi check requires a business name and location (city or state).",
      },
      { status: 400 },
    );
  }

  const country =
    row.country === "US" || row.country === "GB" || row.country === "AU"
      ? row.country
      : "US";

  const detected = await detectAngiListingForBusiness(
    {
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      phone: row.phone,
      country,
      mainCategory: row.main_category,
      businessType: row.business_type,
      directoryCategorySlug: row.directory_category_slug,
    },
    credentials,
  );

  if (!detected.ok) {
    return NextResponse.json(
      { error: detected.error },
      { status: detected.httpStatus === 429 ? 429 : 502 },
    );
  }

  const { result } = detected;
  const { error: updateError } = await admin
    .from("businesses_nowebsite")
    .update({
      has_angi_listing: result.hasListing,
      angi_listing_url: result.url,
      angi_listing_title: result.title,
      angi_listing_confidence: result.confidence,
      angi_competitors: result.competitors,
      angi_listing_checked_at: result.checkedAt,
      angi_owner_name: result.angiOwnerName ?? null,
    })
    .eq("place_id", placeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (result.angiOwnerName) {
    const existing = await fetchCrmUserContact(supabase, user.id, placeId);
    if (!existing.owner_name?.trim()) {
      await upsertCrmUserContact(supabase, user.id, placeId, {
        owner_name: result.angiOwnerName,
      });
    }
  }

  return NextResponse.json({
    placeId,
    has_angi_listing: result.hasListing,
    angi_listing_url: result.url,
    angi_listing_title: result.title,
    angi_listing_confidence: result.confidence,
    angi_competitors: result.competitors,
    angi_listing_checked_at: result.checkedAt,
    angi_owner_name: result.angiOwnerName ?? null,
    verification: result.verification ?? null,
    scrapeSignals: result.scrapeSignals ?? [],
    competitors: parseAngiCompetitorsJson(result.competitors),
  });
}
