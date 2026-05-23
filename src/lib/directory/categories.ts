/** Canonical nationwide category pages — slug is the public URL segment. */
export interface CanonicalCategory {
  slug: string;
  /** Normalized `business_type` value in the database. */
  businessType: string;
  /** Display label source (used with formatCategoryDisplayName). */
  label: string;
}

export const CANONICAL_CATEGORIES: readonly CanonicalCategory[] = [
  { slug: "restaurant", businessType: "restaurant", label: "restaurant" },
  { slug: "plumber", businessType: "plumber", label: "plumber" },
  { slug: "electrician", businessType: "electrician", label: "electrician" },
  { slug: "roofer", businessType: "roofer", label: "roofer" },
  { slug: "landscaping", businessType: "landscaping", label: "landscaping" },
  { slug: "hair-salon", businessType: "hair_salon", label: "hair_salon" },
  { slug: "spa", businessType: "spa", label: "spa" },
  { slug: "painter", businessType: "painter", label: "painter" },
  { slug: "contractor", businessType: "contractor", label: "contractor" },
  {
    slug: "event-services",
    businessType: "event_services",
    label: "event_services",
  },
  { slug: "laundromat", businessType: "laundromat", label: "laundromat" },
  { slug: "handyman", businessType: "handyman", label: "handyman" },
  { slug: "auto-repair", businessType: "auto_repair", label: "auto_repair" },
] as const;

const SLUG_TO_CATEGORY = new Map(
  CANONICAL_CATEGORIES.map((c) => [c.slug, c] as const),
);

const BUSINESS_TYPE_TO_CATEGORY = new Map(
  CANONICAL_CATEGORIES.map((c) => [c.businessType, c] as const),
);

export function canonicalCategoryFromSlug(
  slug: string,
): CanonicalCategory | null {
  return SLUG_TO_CATEGORY.get(slug.trim().toLowerCase()) ?? null;
}

export function isCanonicalCategorySlug(slug: string): boolean {
  return canonicalCategoryFromSlug(slug) !== null;
}

export function canonicalCategoryFromBusinessType(
  businessType: string,
): CanonicalCategory | null {
  const normalized = businessType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return BUSINESS_TYPE_TO_CATEGORY.get(normalized) ?? null;
}

export function canonicalCategoryPath(slug: string): string {
  return `/${slug}`;
}
