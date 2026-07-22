import { DEMO_DETAIL_COLUMNS } from "@/lib/crm-cohort";
import { isLikelyGooglePlaceId } from "@/lib/demo-slug";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function leadSlugFromBusiness(row: Record<string, unknown>): string {
  const demoSlug = row.demo_slug;
  if (typeof demoSlug === "string" && demoSlug.trim()) {
    return demoSlug.trim().toLowerCase();
  }
  return String(row.place_id ?? "").trim();
}

function buildLeadUpsertRow(
  userId: string,
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    user_id: userId,
    slug: leadSlugFromBusiness(row),
    place_id: String(row.place_id ?? ""),
    name: row.name ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    postal_code: row.postal_code ?? null,
    business_type: row.business_type ?? null,
    main_category: row.main_category ?? null,
    rating: row.rating ?? null,
    reviews: row.reviews ?? null,
    phone: row.phone ?? null,
    google_maps_link: row.google_maps_link ?? null,
    facebook_url: row.facebook_url ?? null,
    contact_enrichment: row.contact_enrichment ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    is_spending_on_ads: row.is_spending_on_ads ?? null,
    competitive_weakness: row.competitive_weakness ?? null,
    review_highlights: row.review_highlights ?? null,
    services_offered: row.services_offered ?? null,
    hours: row.hours ?? null,
    open_now: row.open_now ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertTenantLeadFromBusiness(
  userId: string,
  business: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const payload = buildLeadUpsertRow(userId, business);
  if (!payload.slug || !payload.place_id) {
    throw new Error("Business is missing slug or place_id");
  }

  const { error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "user_id,slug" });

  if (error) {
    throw new Error(error.message);
  }
}

export interface MaterializedTenantLead {
  business: Record<string, unknown>;
  postcardReturnAddress: unknown;
}

/** Copy a global CRM business into tenant leads on first demo view or CRM click. */
export async function materializeTenantLeadBySlug(
  username: string,
  leadSlug: string,
): Promise<MaterializedTenantLead | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedSlug = leadSlug.trim().toLowerCase();
  if (!normalizedUsername || !normalizedSlug) return null;

  const supabase = createSupabaseAdmin();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, postcard_return_address")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) return null;

  let businessQuery = supabase
    .from("businesses_nowebsite")
    .select(DEMO_DETAIL_COLUMNS)
    .eq("is_invalid", false)
    .eq("is_test", false);

  if (isLikelyGooglePlaceId(normalizedSlug)) {
    businessQuery = businessQuery.eq("place_id", normalizedSlug);
  } else {
    businessQuery = businessQuery.eq("demo_slug", normalizedSlug);
  }

  const { data: business, error: businessError } =
    await businessQuery.maybeSingle();

  if (businessError) throw new Error(businessError.message);
  if (!business) return null;

  await upsertTenantLeadFromBusiness(
    String(profile.id),
    business as Record<string, unknown>,
  );

  return {
    business: business as Record<string, unknown>,
    postcardReturnAddress: profile.postcard_return_address,
  };
}

export async function materializeTenantLeadByPlaceId(
  userId: string,
  placeId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: business, error } = await supabase
    .from("businesses_nowebsite")
    .select(DEMO_DETAIL_COLUMNS)
    .eq("is_invalid", false)
    .eq("place_id", placeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!business) return false;

  await upsertTenantLeadFromBusiness(userId, business as Record<string, unknown>);
  return true;
}
