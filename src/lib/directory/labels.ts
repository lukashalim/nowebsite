import { COUNTRY_GB } from "@/lib/directory/country";
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
  const abbr = stateToAbbr(state);
  if (abbr) {
    return `${city.trim()}, ${abbr.toUpperCase()}`;
  }
  return `${city.trim()}, ${state.trim()}`;
}

/** Turn DB/scraper values like `event_services` or `painter` into "Event Services", "Painter". */
export function formatCategoryDisplayName(raw: string): string {
  const t = raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!t) return "Business";
  return t
    .split(" ")
    .map((word) => {
      if (!word) return word;
      // Only force uppercase for 1–2 letter tokens (e.g. "IT"); keep words like "spa" → "Spa".
      if (word.length <= 2 && /^[a-z]+$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
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

export function cityHubTitle(
  city: string,
  state: string,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  return `Businesses Without a Website in ${formatLocationLabel(city, state, country, region)}`;
}

export function cityHubMetaDescription(
  city: string,
  state: string,
  listingCount: number,
  lastUpdatedLabel: string | null = null,
  country: DirectoryCountry = "US",
  region?: string | null,
): string {
  const place = formatLocationLabel(city, state, country, region);
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  return `Directory of ${listingCount} local businesses in ${place} that do not have a website — phone numbers, ratings, and Google Maps links for designers and agencies.${updated}`;
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
