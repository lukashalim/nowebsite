/**
 * Canonical category slug merges. Secondary slugs redirect to primary; legacy
 * business_type values normalize to canonicalBusinessType (DB + scrape).
 */

export interface CategoryMergeGroup {
  primarySlug: string;
  canonicalBusinessType: string;
  secondarySlugs: readonly string[];
  legacyBusinessTypes: readonly string[];
}

export const CATEGORY_MERGE_GROUPS: readonly CategoryMergeGroup[] = [
  {
    primarySlug: "hair-salon",
    canonicalBusinessType: "hair_salon",
    secondarySlugs: ["beauty-salon", "hairdresser"],
    legacyBusinessTypes: ["hair_salon", "beauty_salon", "hairdresser"],
  },
  {
    primarySlug: "barber-shop",
    canonicalBusinessType: "barber_shop",
    secondarySlugs: ["barber"],
    legacyBusinessTypes: ["barber"],
  },
  {
    primarySlug: "laundromat",
    canonicalBusinessType: "laundromat",
    secondarySlugs: ["laundry-service", "laundry"],
    legacyBusinessTypes: ["laundry_service", "laundry"],
  },
  {
    primarySlug: "dentist",
    canonicalBusinessType: "dentist",
    secondarySlugs: ["dental-clinic"],
    legacyBusinessTypes: ["dental_clinic"],
  },
  {
    primarySlug: "massage-spa",
    canonicalBusinessType: "massage_spa",
    secondarySlugs: ["massage-therapist"],
    legacyBusinessTypes: ["massage_therapist"],
  },
  {
    primarySlug: "restaurant",
    canonicalBusinessType: "restaurant",
    secondarySlugs: [
      "american-restaurant",
      "mexican-restaurant",
      "takeout-restaurant",
      "barbecue-restaurant",
      "breakfast-restaurant",
      "fast-food-restaurant",
      "family-restaurant",
      "bar-grill",
    ],
    legacyBusinessTypes: [
      "american_restaurant",
      "mexican_restaurant",
      "takeout_restaurant",
      "barbecue_restaurant",
      "breakfast_restaurant",
      "fast_food_restaurant",
      "family_restaurant",
      "bar_grill",
    ],
  },
  {
    primarySlug: "landscaper",
    canonicalBusinessType: "landscaper",
    secondarySlugs: ["lawn-care-service", "gardener"],
    legacyBusinessTypes: ["lawn_care_service", "gardener"],
  },
  {
    primarySlug: "bar",
    canonicalBusinessType: "bar",
    secondarySlugs: ["pub"],
    legacyBusinessTypes: ["pub"],
  },
  {
    primarySlug: "dry-cleaner",
    canonicalBusinessType: "dry_cleaner",
    secondarySlugs: ["cleaners"],
    legacyBusinessTypes: ["cleaners", "cleaner"],
  },
  {
    primarySlug: "pet-groomer",
    canonicalBusinessType: "pet_groomer",
    secondarySlugs: ["pet-store", "pet-supply-store"],
    legacyBusinessTypes: ["pet_store", "pet_supply_store"],
  },
  {
    primarySlug: "hvac-contractor",
    canonicalBusinessType: "hvac_contractor",
    secondarySlugs: ["heating-contractor"],
    legacyBusinessTypes: ["heating_contractor"],
  },
] as const;

function normalizeTypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const secondarySlugToPrimary = new Map<string, string>();
const legacyTypeToCanonical = new Map<string, string>();

for (const group of CATEGORY_MERGE_GROUPS) {
  for (const slug of group.secondarySlugs) {
    secondarySlugToPrimary.set(slug.toLowerCase(), group.primarySlug);
  }
  for (const legacy of group.legacyBusinessTypes) {
    legacyTypeToCanonical.set(normalizeTypeKey(legacy), group.canonicalBusinessType);
  }
  legacyTypeToCanonical.set(
    normalizeTypeKey(group.canonicalBusinessType),
    group.canonicalBusinessType,
  );
}

/** Flat slug used in URLs after merge (secondary → primary). */
export function canonicalCategorySlug(slug: string): string {
  const lower = slug.trim().toLowerCase();
  return secondarySlugToPrimary.get(lower) ?? lower;
}

/** Redirect target when URL uses a merged-away slug; null if already canonical. */
export function mergedCategorySlugToCanonical(slug: string): string | null {
  const lower = slug.trim().toLowerCase();
  const primary = secondarySlugToPrimary.get(lower);
  return primary ?? null;
}

/** Normalize stored business_type / main_category tokens to canonical values. */
export function canonicalizeBusinessTypeToken(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const key = normalizeTypeKey(value);
  if (!key) return null;
  return legacyTypeToCanonical.get(key) ?? value.trim();
}

export function isMergedSecondarySlug(slug: string): boolean {
  return secondarySlugToPrimary.has(slug.trim().toLowerCase());
}
