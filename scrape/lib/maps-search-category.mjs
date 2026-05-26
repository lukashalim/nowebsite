import { canonicalizeBusinessTypeToken } from "./category-merge.mjs";

/** Maps search URL keyword → stored `business_type` slug. Keep in sync with src/lib/directory/search-category-map.ts */
export const MAPS_SEARCH_CATEGORY_MAP = {
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

/**
 * Extract search keyword from a Google Maps search URL path.
 * Supports `.../search/restaurants+in+austin+texas` and `.../search/plumber+near+78701`.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function extractSearchKeywordFromMapsUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    const pathStart = trimmed.indexOf("/maps/");
    if (pathStart !== -1) {
      pathname = trimmed.slice(pathStart);
    }
  }

  const searchMarker = "/search/";
  const idx = pathname.toLowerCase().indexOf(searchMarker);
  if (idx === -1) return null;

  let segment = pathname.slice(idx + searchMarker.length).split("?")[0] ?? "";
  segment = segment.replace(/\/+$/, "");
  if (!segment) return null;

  const lower = segment.toLowerCase();
  const inPos = lower.indexOf("+in+");
  if (inPos !== -1) {
    return segment.slice(0, inPos);
  }
  const nearPos = lower.indexOf("+near+");
  if (nearPos !== -1) {
    return segment.slice(0, nearPos);
  }

  return segment;
}

/**
 * @param {string|null|undefined} keyword
 * @returns {string|null}
 */
export function mapSearchKeywordToBusinessType(keyword) {
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

/**
 * @param {string|null|undefined} mainCategory — GBP main_category
 * @returns {string|null}
 */
export function businessTypeFromMainCategory(mainCategory) {
  const label = mainCategory?.trim();
  if (!label) return null;
  const fromMap = mapSearchKeywordToBusinessType(label);
  if (fromMap) return fromMap;
  const normalized =
    label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || null;
  return canonicalizeBusinessTypeToken(normalized) ?? normalized;
}

/**
 * Resolve `business_type` for upsert: search URL keyword → map → main_category.
 *
 * @param {string|null|undefined} searchUrl
 * @param {string|null|undefined} mainCategory
 * @returns {string|null}
 */
export function resolveBusinessTypeFromMapsSearch(searchUrl, mainCategory) {
  const keyword = extractSearchKeywordFromMapsUrl(searchUrl ?? "");
  const mapped = mapSearchKeywordToBusinessType(keyword);
  if (mapped) return mapped;
  return businessTypeFromMainCategory(mainCategory);
}
