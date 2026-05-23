/** Keep in sync with scrape/lib/maps-search-category.mjs */
const MAPS_SEARCH_CATEGORY_MAP: Record<string, string> = {
  restaurants: "restaurant",
  restaurant: "restaurant",
  plumbers: "plumber",
  plumber: "plumber",
  electricians: "electrician",
  electrician: "electrician",
  roofers: "roofer",
  roofing: "roofer",
  landscaping: "landscaping",
  "hair+salon": "hair_salon",
  "hair salon": "hair_salon",
  spa: "spa",
  spas: "spa",
  painters: "painter",
  painting: "painter",
  handyman: "handyman",
  contractors: "contractor",
  contractor: "contractor",
};

export function mapSearchKeywordToBusinessType(
  keyword: string | null | undefined,
): string | null {
  if (!keyword) return null;
  const raw = keyword.trim().toLowerCase();
  if (!raw) return null;

  const candidates = [
    raw,
    raw.replace(/\s+/g, "+"),
    raw.replace(/\+/g, " "),
    raw.split(/[\s+]+/)[0],
  ];

  for (const c of candidates) {
    if (!c) continue;
    const hit = MAPS_SEARCH_CATEGORY_MAP[c];
    if (hit) return hit;
  }

  return null;
}

/** Resolve `business_type` filter for last_scraped_at query from category URL slug. */
export function businessTypeFromCategorySlug(categorySlug: string): string | null {
  const lower = categorySlug.trim().toLowerCase();
  const suffix = "-without-a-website";
  if (!lower.endsWith(suffix)) return null;
  const term = lower.slice(0, -suffix.length).replace(/-/g, " ");
  return mapSearchKeywordToBusinessType(term);
}
