import { mapRowToDemoBusiness, type DemoBusiness } from "@/lib/crm-cohort";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { materializeTenantLeadBySlug } from "@/lib/tenant-lead-sync";

export {
  DEFAULT_PAYMENT_LINK,
  resolveTenantPaymentLink,
} from "@/lib/tenant-payment-defaults";
export { tenantDemoPublicPath } from "@/lib/demo-slug";

export type TenantDemoLead = DemoBusiness;

export interface TenantDemoLeadResult {
  lead: TenantDemoLead;
  userPaymentLink: string | null;
}

const LEAD_DETAIL_SELECT = `
  place_id, slug, name, address, city, state, postal_code,
  business_type, main_category, rating, reviews, phone,
  google_maps_link, facebook_url, contact_enrichment,
  latitude, longitude, is_spending_on_ads, competitive_weakness,
  review_highlights, services_offered, hours, open_now,
  profiles!inner(username, user_payment_link)
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

export async function fetchTenantDemoLead(
  username: string,
  slug: string,
): Promise<TenantDemoLeadResult | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedUsername || !normalizedSlug) return null;

  const supabase = createSupabaseAdmin();
  let { data, error } = await supabase
    .from("leads")
    .select(LEAD_DETAIL_SELECT)
    .eq("slug", normalizedSlug)
    .eq("profiles.username", normalizedUsername)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const materialized = await materializeTenantLeadBySlug(
      normalizedUsername,
      normalizedSlug,
    );
    if (materialized) {
      const retry = await supabase
        .from("leads")
        .select(LEAD_DETAIL_SELECT)
        .eq("slug", normalizedSlug)
        .eq("profiles.username", normalizedUsername)
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) throw new Error(error.message);
  if (!data) return null;

  const profile = data.profiles as {
    username?: string;
    user_payment_link?: string | null;
  };
  const lead = mapLeadRowToDemoBusiness(data as Record<string, unknown>);

  return {
    lead,
    userPaymentLink: profile?.user_payment_link ?? null,
  };
}
