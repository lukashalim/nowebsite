import { canonicalizeBusinessTypeToken } from "@/lib/directory/category-merge";

/** Keep in sync with scrape/lib/maps-search-category.mjs */
const MAPS_SEARCH_CATEGORY_MAP: Record<string, string> = {
  restaurants: "restaurant",
  restaurant: "restaurant",
  "american+restaurant": "restaurant",
  "american restaurant": "restaurant",
  "mexican+restaurant": "restaurant",
  "mexican restaurant": "restaurant",
  "fast+food+restaurant": "restaurant",
  "fast food restaurant": "restaurant",
  "breakfast+restaurant": "restaurant",
  "breakfast restaurant": "restaurant",
  "barbecue+restaurant": "restaurant",
  "barbecue restaurant": "restaurant",
  "takeout+restaurant": "restaurant",
  "family+restaurant": "restaurant",
  "bar+grill": "restaurant",
  "bar grill": "restaurant",
  barber: "barber_shop",
  barbers: "barber_shop",
  "hair+salon": "barber_shop",
  "hair salon": "barber_shop",
  "beauty+salon": "barber_shop",
  "beauty salon": "barber_shop",
  hairdresser: "barber_shop",
  laundry: "laundromat",
  "laundry+service": "laundromat",
  "laundry service": "laundromat",
  "dental+clinic": "dentist",
  "dental clinic": "dentist",
  "massage+therapist": "massage_spa",
  "massage therapist": "massage_spa",
  "massage+spa": "massage_spa",
  "massage spa": "massage_spa",
  gardener: "landscaper",
  gardeners: "landscaper",
  "lawn+care+service": "landscaper",
  "lawn care service": "landscaper",
  pub: "bar",
  pubs: "bar",
  cleaners: "dry_cleaner",
  cleaner: "dry_cleaner",
  "dry+cleaner": "dry_cleaner",
  "dry cleaner": "dry_cleaner",
  "pet+store": "pet_groomer",
  "pet store": "pet_groomer",
  "pet+supply+store": "pet_groomer",
  "pet supply store": "pet_groomer",
  "pet+groomer": "pet_groomer",
  "pet groomer": "pet_groomer",
  "heating+contractor": "hvac_contractor",
  "heating contractor": "hvac_contractor",
  "hvac+contractor": "hvac_contractor",
  plumbers: "plumber",
  plumber: "plumber",
  electricians: "electrician",
  electrician: "electrician",
  roofers: "roofer",
  roofing: "roofer",
  landscaping: "landscaping",
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
    if (hit) return canonicalizeBusinessTypeToken(hit) ?? hit;
  }

  return canonicalizeBusinessTypeToken(raw);
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
  const canonical = canonicalizeBusinessTypeToken(normalized);
  return canonical ?? (normalized || null);
}
