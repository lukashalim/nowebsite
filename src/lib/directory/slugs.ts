import { COUNTRY_GB, COUNTRY_US } from "@/lib/directory/country";
import type { DirectoryCountry } from "@/lib/directory/types";
import { mapSearchKeywordToBusinessType } from "@/lib/directory/search-category-map";

export { parseUkRegionSlug, ukRegionNameToSlug } from "@/lib/directory/country";
export type { DirectoryCountry } from "@/lib/directory/types";

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
  "district of columbia": "dc",
};

const STATE_ABBR_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]),
);

const STATE_SLUG_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [
    slugifySegment(name),
    abbr,
  ]),
);

const LEGACY_CATEGORY_SLUG_SUFFIX = "-without-a-website";

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ResolvedCategory {
  slug: string;
  label: string;
}

export function stateToAbbr(state: string): string | null {
  const raw = state.trim().toLowerCase();
  if (!raw) return null;
  if (raw.length === 2 && STATE_ABBR_TO_NAME[raw]) return raw;
  return STATE_NAME_TO_ABBR[raw] ?? null;
}

export function stateAbbrToDisplayName(abbr: string): string {
  const key = abbr.trim().toLowerCase();
  const name = STATE_ABBR_TO_NAME[key];
  if (!name) return abbr.toUpperCase();
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function stateNameToSlug(state: string): string | null {
  const abbr = stateToAbbr(state);
  if (!abbr) return null;
  const name = STATE_ABBR_TO_NAME[abbr];
  if (!name) return null;
  return slugifySegment(name);
}

export function parseStateSlug(
  stateSlug: string,
): { stateAbbr: string; stateName: string } | null {
  const slug = stateSlug.trim().toLowerCase();
  const abbr = STATE_SLUG_TO_ABBR[slug];
  if (!abbr) return null;
  const stateName = STATE_ABBR_TO_NAME[abbr];
  if (!stateName) return null;
  return { stateAbbr: abbr, stateName };
}

/** Flat public URL segment from a category label / business_type (e.g. `hair_salon` → `hair-salon`). */
export function categoryLabelToFlatSlug(label: string): string {
  const base = label.trim().toLowerCase().replace(/_/g, "-");
  const slug = slugifySegment(base.replace(/-/g, " "));
  return slug || "business";
}

const UK_CITY_SUFFIX = "gb";

export function cityStateToSlug(
  city: string,
  state: string,
  country: DirectoryCountry = COUNTRY_US,
): string | null {
  const cityPart = slugifySegment(city);
  if (!cityPart) return null;
  if (country === COUNTRY_GB) {
    return `${cityPart}-${UK_CITY_SUFFIX}`;
  }
  const abbr = stateToAbbr(state);
  if (!abbr) return null;
  return `${cityPart}-${abbr}`;
}

export type ParsedCitySlug =
  | { country: typeof COUNTRY_US; cityPattern: string; stateAbbr: string }
  | { country: typeof COUNTRY_GB; cityPattern: string };

export function parseCitySlug(citySlug: string): ParsedCitySlug | null {
  const lower = citySlug.trim().toLowerCase();
  const gbMatch = /^(.+)-gb$/i.exec(lower);
  if (gbMatch) {
    return {
      country: COUNTRY_GB,
      cityPattern: gbMatch[1].replace(/-/g, " ").trim(),
    };
  }
  const match = /^(.+)-([a-z]{2})$/i.exec(lower);
  if (!match) return null;
  const cityPattern = match[1].replace(/-/g, " ").trim();
  const stateAbbr = match[2].toLowerCase();
  if (stateAbbr === UK_CITY_SUFFIX || !STATE_ABBR_TO_NAME[stateAbbr]) return null;
  return { country: COUNTRY_US, cityPattern, stateAbbr };
}

/** Legacy `painting-without-a-website` → flat slug e.g. `painter`. */
export function legacyCategorySlugToCanonical(slug: string): string | null {
  const lower = slug.trim().toLowerCase();
  if (!lower.endsWith(LEGACY_CATEGORY_SLUG_SUFFIX)) return null;
  const base = lower
    .slice(0, -LEGACY_CATEGORY_SLUG_SUFFIX.length)
    .replace(/-/g, " ");
  if (!base.trim()) return null;

  const fromMap = mapSearchKeywordToBusinessType(base);
  const label = fromMap ?? base.trim().replace(/\s+/g, "_");
  return categoryLabelToFlatSlug(label);
}

export function parseLegacyCategorySlug(
  categorySlug: string,
): { searchTerm: string } | null {
  const lower = categorySlug.trim().toLowerCase();
  if (!lower.endsWith(LEGACY_CATEGORY_SLUG_SUFFIX)) return null;
  const base = lower
    .slice(0, -LEGACY_CATEGORY_SLUG_SUFFIX.length)
    .replace(/-/g, " ");
  if (!base.trim()) return null;
  return { searchTerm: base.trim() };
}

/** @deprecated Legacy suffix URLs. */
export function categoryLabelToSlug(label: string): string {
  return `${categoryLabelToFlatSlug(label)}${LEGACY_CATEGORY_SLUG_SUFFIX}`;
}

/** @deprecated Use parseLegacyCategorySlug. */
export function parseCategorySlug(
  categorySlug: string,
): { searchTerm: string } | null {
  return parseLegacyCategorySlug(categorySlug);
}

export function isPlaceholderBusinessType(
  value: string | null | undefined,
): boolean {
  if (!value) return true;
  const t = value
    .trim()
    .toLowerCase()
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t === "local cache" || t === "local_cache";
}

/** Primary category label for directory grouping (business_type first, then main_category). */
export function directoryCategoryLabel(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): string | null {
  const type = businessType?.trim();
  if (type && !isPlaceholderBusinessType(type)) {
    const mapped = mapSearchKeywordToBusinessType(type);
    return mapped ?? type;
  }
  const main = mainCategory?.trim();
  if (!main) return null;
  const fromMap = mapSearchKeywordToBusinessType(main);
  return fromMap ?? main;
}

/** Resolve row to a stable category slug + label for URLs and counts. */
export function resolveCategoryForRow(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): ResolvedCategory | null {
  const label = directoryCategoryLabel(mainCategory, businessType);
  if (!label) return null;
  return {
    slug: categoryLabelToFlatSlug(label),
    label,
  };
}

export function cityMatchesSlug(
  city: string | null | undefined,
  state: string | null | undefined,
  citySlug: string,
  country: DirectoryCountry = COUNTRY_US,
): boolean {
  if (!city?.trim() || !state?.trim()) return false;
  return (
    cityStateToSlug(city, state, country) === citySlug.trim().toLowerCase()
  );
}

export function categoryMatchesSlug(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
  categorySlug: string,
): boolean {
  const resolved = resolveCategoryForRow(mainCategory, businessType);
  if (!resolved) return false;
  return resolved.slug === categorySlug.trim().toLowerCase();
}

/** @deprecated Whitelist removed — use fetchNationwideCategoryListings to test publishability. */
export function isCanonicalCategorySlug(_slug: string): boolean {
  return false;
}

/** @deprecated Use resolveCategoryForRow. */
export function resolveCanonicalCategoryForRow(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): ResolvedCategory | null {
  return resolveCategoryForRow(mainCategory, businessType);
}

/** @deprecated Use categoryMatchesSlug. */
export function categoryMatchesCanonicalSlug(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
  categorySlug: string,
): boolean {
  return categoryMatchesSlug(mainCategory, businessType, categorySlug);
}
