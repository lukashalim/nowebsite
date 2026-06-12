/**
 * Load home-services category slugs from Supabase taxonomy (fallback to static list).
 */

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
    .eq("group_id", "home-services")
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
