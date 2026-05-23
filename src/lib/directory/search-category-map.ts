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
  "event+services": "event_services",
  "event services": "event_services",
  "event-services": "event_services",
  event_services: "event_services",
  laundromat: "laundromat",
  laundromats: "laundromat",
  "auto+repair": "auto_repair",
  "auto repair": "auto_repair",
  "auto-repair": "auto_repair",
  auto_repair: "auto_repair",
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

/** Resolve `business_type` filter from a canonical or legacy category URL slug. */
export function businessTypeFromCategorySlug(categorySlug: string): string | null {
  const lower = categorySlug.trim().toLowerCase();
  const suffix = "-without-a-website";
  const term = lower.endsWith(suffix)
    ? lower.slice(0, -suffix.length).replace(/-/g, " ")
    : lower.replace(/-/g, " ");
  const fromMap = mapSearchKeywordToBusinessType(term);
  if (fromMap) return fromMap;
  const normalized = term.replace(/\s+/g, "_").replace(/-+/g, "_");
  return normalized || null;
}
