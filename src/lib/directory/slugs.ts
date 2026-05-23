import {
  canonicalCategoryFromBusinessType,
  canonicalCategoryFromSlug,
  type CanonicalCategory,
} from "@/lib/directory/categories";
import { mapSearchKeywordToBusinessType } from "@/lib/directory/search-category-map";

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

/** Matches rows where `lower(regexp_replace(city, '\\s+', '-', 'g')) || '-' || state_abbr` equals slug. */
export function cityStateToSlug(city: string, state: string): string | null {
  const cityPart = slugifySegment(city);
  const abbr = stateToAbbr(state);
  if (!cityPart || !abbr) return null;
  return `${cityPart}-${abbr}`;
}

export function parseCitySlug(
  citySlug: string,
): { cityPattern: string; stateAbbr: string } | null {
  const match = /^(.+)-([a-z]{2})$/i.exec(citySlug.trim().toLowerCase());
  if (!match) return null;
  const cityPattern = match[1].replace(/-/g, " ").trim();
  const stateAbbr = match[2].toLowerCase();
  if (!STATE_ABBR_TO_NAME[stateAbbr]) return null;
  return { cityPattern, stateAbbr };
}

export function isCanonicalCategorySlug(slug: string): boolean {
  return canonicalCategoryFromSlug(slug) !== null;
}

/** Legacy `painting-without-a-website` → canonical slug e.g. `painter`. */
export function legacyCategorySlugToCanonical(slug: string): string | null {
  const lower = slug.trim().toLowerCase();
  if (!lower.endsWith(LEGACY_CATEGORY_SLUG_SUFFIX)) return null;
  const base = lower
    .slice(0, -LEGACY_CATEGORY_SLUG_SUFFIX.length)
    .replace(/-/g, " ");
  if (!base.trim()) return null;

  const fromMap = mapSearchKeywordToBusinessType(base);
  if (fromMap) {
    const cat = canonicalCategoryFromBusinessType(fromMap);
    if (cat) return cat.slug;
  }

  const normalized = base.replace(/\s+/g, "_");
  const cat = canonicalCategoryFromBusinessType(normalized);
  return cat?.slug ?? null;
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

/** @deprecated Legacy suffix URLs; use canonical slugs. */
export function categoryLabelToSlug(label: string): string {
  const base = slugifySegment(label);
  if (!base) return `business${LEGACY_CATEGORY_SLUG_SUFFIX}`;
  return `${base}${LEGACY_CATEGORY_SLUG_SUFFIX}`;
}

/** @deprecated Use isCanonicalCategorySlug or legacyCategorySlugToCanonical. */
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

function normalizeBusinessTypeValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Resolve row to canonical category, if any. */
export function resolveCanonicalCategoryForRow(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): CanonicalCategory | null {
  const type = businessType?.trim();
  if (type && !isPlaceholderBusinessType(type)) {
    const cat = canonicalCategoryFromBusinessType(normalizeBusinessTypeValue(type));
    if (cat) return cat;
  }

  const main = mainCategory?.trim();
  if (main) {
    const fromMap = mapSearchKeywordToBusinessType(main);
    if (fromMap) {
      const cat = canonicalCategoryFromBusinessType(fromMap);
      if (cat) return cat;
    }
    const normalized = normalizeBusinessTypeValue(main);
    const cat = canonicalCategoryFromBusinessType(normalized);
    if (cat) return cat;
  }

  return null;
}

/** Primary category label for directory grouping (business_type first, then main_category). */
export function directoryCategoryLabel(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): string | null {
  const canonical = resolveCanonicalCategoryForRow(mainCategory, businessType);
  if (canonical) return canonical.label;

  const type = businessType?.trim();
  if (type && !isPlaceholderBusinessType(type)) return type;
  const main = mainCategory?.trim();
  if (main) return main;
  return null;
}

export function cityMatchesSlug(
  city: string | null | undefined,
  state: string | null | undefined,
  citySlug: string,
): boolean {
  if (!city?.trim() || !state?.trim()) return false;
  return cityStateToSlug(city, state) === citySlug.trim().toLowerCase();
}

export function categoryMatchesCanonicalSlug(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
  categorySlug: string,
): boolean {
  const canonical = resolveCanonicalCategoryForRow(mainCategory, businessType);
  if (!canonical) return false;
  return canonical.slug === categorySlug.trim().toLowerCase();
}
