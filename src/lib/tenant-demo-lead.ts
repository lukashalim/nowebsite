import { cache } from "react";
import { mapRowToDemoBusiness, type DemoBusiness } from "@/lib/crm-cohort";
import { normalizePhoneE164 } from "@/lib/phone-lookup";
import { postcardReturnAddressFromUnknown } from "@/lib/postcard/address";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { materializeTenantLeadBySlug } from "@/lib/tenant-lead-sync";

export { tenantDemoPublicPath } from "@/lib/demo-slug";

export type TenantDemoLead = DemoBusiness;

export interface TenantDemoLeadResult {
  lead: TenantDemoLead;
  outreachPhone: string | null;
}

const LEAD_DETAIL_SELECT = `
  place_id, slug, name, address, city, state, postal_code,
  business_type, main_category, rating, reviews, phone,
  google_maps_link, facebook_url, contact_enrichment,
  latitude, longitude, is_spending_on_ads, competitive_weakness,
  review_highlights, services_offered, hours, open_now,
  profiles!inner(username, postcard_return_address)
`;

function mapLeadRowToDemoBusiness(
  data: Record<string, unknown>,
): DemoBusiness {
  const slugRaw = data.slug;
  const demo_slug =
    typeof slugRaw === "string" && slugRaw.trim()
      ? slugRaw.trim().toLowerCase()
      : null;
  return mapRowToDemoBusiness({ ...data, demo_slug }, true);
}

function resultFromLeadRow(
  data: Record<string, unknown>,
): TenantDemoLeadResult {
  const profile = data.profiles as {
    username?: string;
    postcard_return_address?: unknown;
  };
  const postcardAddress = postcardReturnAddressFromUnknown(
    profile?.postcard_return_address,
  );
  const outreachPhone = postcardAddress?.contact_phone
    ? normalizePhoneE164(postcardAddress.contact_phone, "US")
    : null;
  return {
    lead: mapLeadRowToDemoBusiness(data),
    outreachPhone,
  };
}

function resultFromMaterialized(input: {
  business: Record<string, unknown>;
  postcardReturnAddress: unknown;
}): TenantDemoLeadResult {
  const postcardAddress = postcardReturnAddressFromUnknown(
    input.postcardReturnAddress,
  );
  const outreachPhone = postcardAddress?.contact_phone
    ? normalizePhoneE164(postcardAddress.contact_phone, "US")
    : null;
  return {
    lead: mapRowToDemoBusiness(input.business, true),
    outreachPhone,
  };
}

/**
 * Resolve a tenant demo lead. Create-on-read materializes from the CRM cohort
 * when missing. Wrapped in React cache() so metadata + page share one load.
 */
export const fetchTenantDemoLead = cache(
  async (
    username: string,
    slug: string,
  ): Promise<TenantDemoLeadResult | null> => {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedUsername || !normalizedSlug) return null;

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_DETAIL_SELECT)
      .eq("slug", normalizedSlug)
      .eq("profiles.username", normalizedUsername)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) {
      return resultFromLeadRow(data as Record<string, unknown>);
    }

    // Do not re-SELECT with the same filters after upsert — Next.js request
    // memoization can reuse the empty GET and 404 even though the row exists.
    const materialized = await materializeTenantLeadBySlug(
      normalizedUsername,
      normalizedSlug,
    );
    if (!materialized) return null;

    return resultFromMaterialized(materialized);
  },
);
