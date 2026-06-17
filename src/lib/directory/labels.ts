import { COUNTRY_AU, COUNTRY_GB } from "@/lib/directory/country";
import { gbCountryPath } from "@/lib/directory/paths";
import type { DirectoryCountry } from "@/lib/directory/types";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";

export function formatCityState(city: string, state: string): string {
  return formatLocationLabel(city, state, "US");
}

export function formatLocationLabel(
  city: string,
  state: string,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  if (country === COUNTRY_GB) {
    const place = region?.trim() || state.trim();
    return `${city.trim()}, ${place}`;
  }
  if (country === COUNTRY_AU) {
    const place = region?.trim() || state.trim();
    return `${city.trim()}, ${place}`;
  }
  const abbr = stateToAbbr(state);
  if (abbr) {
    return `${city.trim()}, ${abbr.toUpperCase()}`;
  }
  return `${city.trim()}, ${state.trim()}`;
}

/** Known technical acronyms in category labels (e.g. HVAC, BBQ). */
const CATEGORY_WORD_ACRONYMS = new Set([
  "ac",
  "atm",
  "bbq",
  "dj",
  "diy",
  "gp",
  "hd",
  "hvac",
  "it",
  "pa",
  "pc",
  "rv",
  "seo",
  "tv",
  "uv",
]);

function formatCategoryWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (CATEGORY_WORD_ACRONYMS.has(lower)) {
    return lower.toUpperCase();
  }
  if (word.length <= 2 && /^[a-z]+$/i.test(word)) {
    return word.toUpperCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Turn DB/scraper values like `event_services` or `painter` into "Event Services", "Painter". */
export function formatCategoryDisplayName(raw: string): string {
  const t = raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!t) return "Business";
  return t.split(" ").map(formatCategoryWord).join(" ");
}

export function pluralCategoryForTitle(label: string): string {
  const t = formatCategoryDisplayName(label);
  if (!t) return "Businesses";
  const lower = t.toLowerCase();
  if (lower.endsWith("s")) return t;
  if (lower.endsWith("y") && !/[aeiou]y$/i.test(lower)) {
    return `${t.slice(0, -1)}ies`;
  }
  if (/(ch|sh|x|z|s)$/i.test(lower)) return `${t}es`;
  return `${t}s`;
}

export function nationwideCategoryPageTitle(categoryLabel: string): string {
  const plural = pluralCategoryForTitle(categoryLabel);
  return `${plural} Without a Website`;
}

export function nationwideCategoryMetaDescription(
  categoryLabel: string,
  count: number,
  cityCount: number,
  lastUpdatedLabel: string | null,
  page?: { current: number; totalPages: number },
): string {
  const plural = pluralCategoryForTitle(categoryLabel).toLowerCase();
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  const pageNote =
    page && page.totalPages > 1
      ? ` Page ${page.current} of ${page.totalPages}.`
      : "";
  return `Browse ${count.toLocaleString()} ${plural} across ${cityCount.toLocaleString()} cities with no website.${pageNote}${updated}`;
}

const SITE_BRAND = "No Website Business Leads";

export function nationwideCategoryMetaTitle(
  categoryLabel: string,
  page?: number,
): string {
  const base = nationwideCategoryPageTitle(categoryLabel);
  const pageSuffix =
    page != null && page > 1 ? ` — Page ${page.toLocaleString()}` : "";
  return `${base}${pageSuffix} | ${SITE_BRAND}`;
}

export function stateHubTitle(state: string): string {
  const display = stateAbbrToDisplayName(stateToAbbr(state) ?? state);
  return `Businesses Without a Website in ${display}`;
}

export function stateHubMetaTitle(
  state: string,
  page?: number,
): string {
  const display = stateAbbrToDisplayName(stateToAbbr(state) ?? state);
  const pageSuffix = page && page > 1 ? ` — Page ${page}` : "";
  return `${display} Businesses Without a Website${pageSuffix} | ${SITE_BRAND}`;
}

export function stateHubMetaDescription(
  state: string,
  count: number,
  cityCount: number,
  lastUpdatedLabel: string | null = null,
  page?: { current: number; totalPages: number },
): string {
  const display = stateAbbrToDisplayName(stateToAbbr(state) ?? state);
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  const pageNote =
    page && page.totalPages > 1
      ? ` Page ${page.current} of ${page.totalPages}.`
      : "";
  return `Browse ${count.toLocaleString()} businesses across ${cityCount.toLocaleString()} cities in ${display} with no website.${pageNote}${updated}`;
}

export function statePath(stateSlug: string): string {
  return `/${stateSlug}`;
}

export function ukHubTitle(): string {
  return "Businesses Without a Website in the United Kingdom";
}

export function gbCountryHubTitle(): string {
  return ukHubTitle();
}

export function gbCountryHubMetaTitle(): string {
  return `${gbCountryHubTitle()} | ${SITE_BRAND}`;
}

export function gbCountryHubMetaDescription(
  count: number,
  cityCount: number,
  lastUpdatedLabel: string | null = null,
): string {
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  return `Browse ${count.toLocaleString()} UK businesses without their own website across ${cityCount.toLocaleString()} cities.${updated}`;
}

export { gbCountryPath } from "@/lib/directory/paths";

export function ukRegionHubTitle(region: string): string {
  return `Businesses Without a Website in ${region}`;
}

export function ukRegionHubMetaTitle(region: string): string {
  return `${region} Businesses Without a Website | ${SITE_BRAND}`;
}

export function ukRegionHubMetaDescription(
  region: string,
  count: number,
  cityCount: number,
  lastUpdatedLabel: string | null = null,
): string {
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  return `Browse ${count.toLocaleString()} businesses across ${cityCount.toLocaleString()} UK cities in ${region} with no website.${updated}`;
}

/** Max place label length before city-hub meta title uses the short fallback. */
const CITY_HUB_META_TITLE_MAX_PLACE = 25;

export function cityHubPlaceLabel(
  city: string,
  state: string,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  return formatLocationLabel(city, state, country, region);
}

export function cityHubMetaTitle(
  city: string,
  state: string,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  const place = cityHubPlaceLabel(city, state, country, region);
  if (place.length > CITY_HUB_META_TITLE_MAX_PLACE) {
    return `${city.trim()} B2B Lead List — No-Website Businesses | Agency Tool`;
  }
  return `${place} B2B Lead List — Businesses Without Websites | Agency Tool`;
}

/** Visible page H1 — intentionally differs from meta title for natural variation. */
export function cityHubH1(
  city: string,
  state: string,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  const place = cityHubPlaceLabel(city, state, country, region);
  return `Agency Prospecting Asset: Businesses Without Websites in ${place}`;
}

/** @deprecated Use cityHubH1 for on-page title and cityHubMetaTitle for metadata. */
export function cityHubTitle(
  city: string,
  state: string,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  return cityHubH1(city, state, country, region);
}

export function cityHubMetaDescription(
  city: string,
  state: string,
  listingCount: number,
  lastUpdatedLabel: string | null = null,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  const place = cityHubPlaceLabel(city, state, country, region);
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  return `Prospecting data for agencies: ${listingCount.toLocaleString()} verified businesses in ${place} with no standalone website. Export-ready B2B lead list with outreach signals and Google Maps verification.${updated}`;
}

export function cityHubHeaderSubcopy(
  place: string,
  city: string,
  count: number,
): string {
  return `${count.toLocaleString()} prospecting records for web design outreach in ${place} — a B2B lead list of agency cold outreach prospects in ${city}. Browse by category segment below, or scan the full export-ready table.`;
}

export function cityHubCategoryH2(city: string): string {
  return `Outreach segmentation by category in ${city}`;
}

export function cityHubCategoryIntro(
  place: string,
  city: string,
  topCategoryLabel?: string | null,
): string {
  const vertical = topCategoryLabel
    ? pluralCategoryForTitle(topCategoryLabel).toLowerCase()
    : "contractors and service businesses";
  return `Local businesses lacking web presence in ${city} — including ${city} ${vertical} without websites. Use these counts to prioritize verticals before opening the full prospect list.`;
}

export function cityHubProspectListH2(place: string): string {
  return `Prospect list for ${place}`;
}

export interface CityHubRevealCopy {
  whyHere: string;
  howToLeverage: string;
  segmentationNote?: string;
}

export function cityHubRevealCopy(
  place: string,
  count: number,
  categoryCount?: number,
): CityHubRevealCopy {
  const segmentationNote =
    categoryCount != null && categoryCount > 0
      ? `${place} currently shows ${categoryCount.toLocaleString()} category segments with ${count.toLocaleString()} total prospects — use the breakdown above to narrow your first campaign before scanning the full table.`
      : undefined;

  return {
    whyHere:
      "Agency owners use this list because businesses without a standalone website represent a measurable gap: established operations with customer reviews but no owned digital presence. That combination signals budget capacity and an unresolved need — the profile that converts highest for web design and digital marketing outreach.",
    howToLeverage:
      "Segment by category and review volume before you contact anyone. Prioritize listings with higher review counts and filter to your service verticals so your pitch references their existing reputation instead of a generic template. Export the list, assign prospects in your CRM, and lead with a specific observation about their Maps presence — that specificity is what lifts reply rates on cold outreach.",
    segmentationNote,
  };
}

export interface CityHubAboutBlock {
  heading: string;
  body: string;
}

export interface CityHubAboutCopy {
  sectionHeading: string;
  blocks: CityHubAboutBlock[];
}

export function cityHubAboutCopy(place: string): CityHubAboutCopy {
  return {
    sectionHeading: "About this prospecting data",
    blocks: [
      {
        heading: "Built for agency prospecting, not consumer lookup",
        body: `This page is a B2B prospecting tool for web design agencies, freelancers, and digital marketers running outbound campaigns in ${place}. It is not a public business directory for consumers searching hours, menus, addresses, or phone numbers for individual brands.`,
      },
      {
        heading: "What each record includes",
        body: "Each row is a verified Google Maps business with no standalone website — sorted by review volume as a proxy for commercial activity. Fields support outreach workflow: business name, city, rating and review count, verification date, and demo preview links. Phone numbers and street addresses are reveal-gated because they are prospecting assets, not consumer service information.",
      },
      {
        heading: "What this page is not",
        body: `This is not a Yelp-style review site, a phone book, or a "near me" local search result. If you are looking for a specific business to visit, call, or check opening hours, use Google Maps directly. If you are building a pipeline of ${place} businesses that need a website, this list is the starting dataset.`,
      },
      {
        heading: "Data methodology",
        body: "Listings are scraped from Google Maps by city, filtered to exclude businesses with an owned website, and refreshed on a rolling schedule. SMBs missing an owned website in this market and high-intent local leads without websites for freelancers are published as verified Google Maps businesses with no standalone site.",
      },
    ],
  };
}

export function categoryAboutPlaceLabel(categoryLabel: string): string {
  const plural = pluralCategoryForTitle(categoryLabel).toLowerCase();
  return `nationwide ${plural} without websites`;
}

export function categoryHubAboutCopy(categoryLabel: string): CityHubAboutCopy {
  const place = categoryAboutPlaceLabel(categoryLabel);
  return {
    sectionHeading: "About this prospecting data",
    blocks: [
      {
        heading: "Built for agency prospecting, not consumer lookup",
        body: `This page is a B2B prospecting tool for web design agencies, freelancers, and digital marketers running outbound campaigns targeting ${place}. It is not a public business directory for consumers searching hours, menus, addresses, or phone numbers for individual brands.`,
      },
      {
        heading: "What each record includes",
        body: "Each row is a verified Google Maps business with no standalone website — sorted by review volume as a proxy for commercial activity. Fields support outreach workflow: business name, category, city, rating and review count, verification date, and demo preview links. Phone numbers and street addresses are reveal-gated because they are prospecting assets, not consumer service information.",
      },
      {
        heading: "What this page is not",
        body: `This is not a Yelp-style review site, a phone book, or a "near me" local search result. If you are looking for a specific business to visit, call, or check opening hours, use Google Maps directly. If you are building a pipeline of ${place} for web design outreach, this list is the starting dataset.`,
      },
      {
        heading: "Data methodology",
        body: "Listings are scraped from Google Maps by city and category, filtered to exclude businesses with an owned website, and refreshed on a rolling schedule. Verified Google Maps businesses with no standalone site are published as export-ready prospecting data for agencies.",
      },
    ],
  };
}

export function categoryLinkLabel(categoryLabel: string): string {
  return pluralCategoryForTitle(formatCategoryDisplayName(categoryLabel));
}

/** Short singular-style label for grids (e.g. "Painter", "Event Services"). */
export function categoryGridLabel(categoryLabel: string): string {
  return formatCategoryDisplayName(categoryLabel);
}

export function categoryPath(categorySlug: string): string {
  return `/${categorySlug}`;
}

export function cityPath(citySlug: string): string {
  return `/${citySlug}`;
}

/** e.g. "May 2026" for directory freshness line. */
export function formatLastUpdatedMonthYear(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Short date for listing table cells, e.g. "May 12, 2026". */
export function formatListingCheckedAt(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Full datetime for listing `title` tooltips. */
export function formatListingCheckedAtTitle(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatNeighborhoodOrArea(
  address: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const raw = address?.trim();
  if (!raw) return null;
  const cityLower = city?.trim().toLowerCase();
  const firstLine = raw.split(",")[0]?.trim();
  if (!firstLine) return null;
  if (cityLower && firstLine.toLowerCase() === cityLower) return null;
  return firstLine;
}
