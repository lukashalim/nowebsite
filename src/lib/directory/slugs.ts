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

const CATEGORY_SLUG_SUFFIX = "-without-a-website";

export function categoryLabelToSlug(label: string): string {
  const base = slugifySegment(label);
  if (!base) return `businesses${CATEGORY_SLUG_SUFFIX}`;
  const plural =
    base.endsWith("s") || base.endsWith("x") || base.endsWith("z")
      ? base
      : `${base}s`;
  return `${plural}${CATEGORY_SLUG_SUFFIX}`;
}

export function parseCategorySlug(
  categorySlug: string,
): { searchTerm: string } | null {
  const lower = categorySlug.trim().toLowerCase();
  if (!lower.endsWith(CATEGORY_SLUG_SUFFIX)) return null;
  const base = lower.slice(0, -CATEGORY_SLUG_SUFFIX.length).replace(/-/g, " ");
  if (!base.trim()) return null;
  return { searchTerm: base.trim() };
}

export function isPlaceholderBusinessType(value: string | null | undefined): boolean {
  if (!value) return true;
  const t = value
    .trim()
    .toLowerCase()
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t === "local cache" || t === "local_cache";
}

/** Primary category label for directory grouping and display. */
export function directoryCategoryLabel(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): string | null {
  const main = mainCategory?.trim();
  if (main) return main;
  const type = businessType?.trim();
  if (type && !isPlaceholderBusinessType(type)) return type;
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

export function categoryMatchesSlug(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
  categorySlug: string,
): boolean {
  const label = directoryCategoryLabel(mainCategory, businessType);
  if (!label) return false;
  return categoryLabelToSlug(label) === categorySlug.trim().toLowerCase();
}
