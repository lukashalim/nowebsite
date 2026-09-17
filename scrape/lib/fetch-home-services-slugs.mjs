/**
 * Load home-services category slugs from Supabase taxonomy (fallback to static list).
 */

export const HIGH_OPPORTUNITY_GROUP_ID = "home-services-high-opportunity";

/** Mail-first emergency / high-ticket trades (fallback if DB taxonomy is missing). */
export const HIGH_OPPORTUNITY_HOME_SERVICES_SLUGS_FALLBACK = [
  "air-conditioning-contractor",
  "air-conditioning-repair-service",
  "arborist-service",
  "bathroom-remodeler",
  "building-restoration-service",
  "chimney-services",
  "chimney-sweep",
  "concrete-contractor",
  "deck-builder",
  "electrical-installation-service",
  "electrician",
  "fence-contractor",
  "fire-damage-restoration-service",
  "furnace-repair-service",
  "gutter-service",
  "hvac-contractor",
  "insulation-contractor",
  "kitchen-remodeler",
  "masonry-contractor",
  "paving-contractor",
  "pest-control-service",
  "plumber",
  "remodeler",
  "roofer",
  "septic-system-service",
  "siding-contractor",
  "swimming-pool-contractor",
  "swimming-pool-repair-service",
  "tree-service",
  "water-damage-restoration-service",
  "waterproofing-service",
  "well-drilling-contractor",
  "window-installation-service",
];

/** Minimal fallback when DB taxonomy is unavailable. */
export const HOME_SERVICES_SLUGS_FALLBACK = [
  "plumber",
  "roofer",
  "hvac-contractor",
  "contractor",
  "electrician",
  "painter",
  "landscaper",
  "tree-service",
  "handyman",
  "mobile-mechanic",
  "mobile-auto-repair",
  "carpet-cleaning-service",
  "house-cleaning-service",
  "electrical-installation-service",
];

export async function fetchHomeServicesSlugs(supabase) {
  const { data, error } = await supabase
    .from("category_group_members")
    .select("category_slug")
    .in("group_id", ["home-services", "home-services-high-opportunity"])
    .order("category_slug", { ascending: true });

  if (error) {
    console.warn(
      `fetchHomeServicesSlugs: ${error.message}; using fallback (${HOME_SERVICES_SLUGS_FALLBACK.length} slugs)`,
    );
    return HOME_SERVICES_SLUGS_FALLBACK;
  }

  const slugs = (data ?? [])
    .map((row) => row.category_slug?.trim().toLowerCase())
    .filter(Boolean);

  if (slugs.length === 0) {
    console.warn(
      `fetchHomeServicesSlugs: empty taxonomy; using fallback (${HOME_SERVICES_SLUGS_FALLBACK.length} slugs)`,
    );
    return HOME_SERVICES_SLUGS_FALLBACK;
  }

  return slugs;
}

export async function fetchHighOpportunityHomeServicesSlugs(supabase) {
  const { data, error } = await supabase
    .from("category_group_members")
    .select("category_slug")
    .eq("group_id", HIGH_OPPORTUNITY_GROUP_ID)
    .order("category_slug", { ascending: true });

  if (error) {
    console.warn(
      `fetchHighOpportunityHomeServicesSlugs: ${error.message}; using fallback (${HIGH_OPPORTUNITY_HOME_SERVICES_SLUGS_FALLBACK.length} slugs)`,
    );
    return HIGH_OPPORTUNITY_HOME_SERVICES_SLUGS_FALLBACK;
  }

  const slugs = (data ?? [])
    .map((row) => row.category_slug?.trim().toLowerCase())
    .filter(Boolean);

  if (slugs.length === 0) {
    console.warn(
      `fetchHighOpportunityHomeServicesSlugs: empty taxonomy; using fallback (${HIGH_OPPORTUNITY_HOME_SERVICES_SLUGS_FALLBACK.length} slugs)`,
    );
    return HIGH_OPPORTUNITY_HOME_SERVICES_SLUGS_FALLBACK;
  }

  return slugs;
}
