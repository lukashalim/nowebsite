/**
 * Derive region + region_code for businesses_nowebsite. Keep US slug rules aligned with
 * src/lib/directory/slugs.ts stateNameToSlug / stateToAbbr.
 */

const STATE_NAME_TO_ABBR = {
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

const STATE_ABBR_TO_NAME = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]),
);

const UK_REGION_NAME_TO_CODE = {
  england: "england",
  scotland: "scotland",
  wales: "wales",
  "northern ireland": "northern-ireland",
};

const WALES_CITIES = new Set([
  "swansea",
  "llanelli",
  "burry port",
  "neath",
]);

function slugifySegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stateToAbbr(state) {
  const raw = state?.trim().toLowerCase();
  if (!raw) return null;
  if (raw.length === 2 && STATE_ABBR_TO_NAME[raw]) return raw;
  return STATE_NAME_TO_ABBR[raw] ?? null;
}

function stateNameToSlug(state) {
  const abbr = stateToAbbr(state);
  if (!abbr) return null;
  const name = STATE_ABBR_TO_NAME[abbr];
  if (!name) return null;
  return slugifySegment(name);
}

function stateAbbrToDisplayName(abbr) {
  const key = abbr.trim().toLowerCase();
  const name = STATE_ABBR_TO_NAME[key];
  if (!name) return abbr.toUpperCase();
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveGbNation(city, state) {
  const cityLower = city?.trim().toLowerCase();
  if (cityLower && WALES_CITIES.has(cityLower)) {
    return { region: "Wales", regionCode: "wales" };
  }
  const nation = state?.trim();
  if (!nation) return { region: null, regionCode: null };
  const code = UK_REGION_NAME_TO_CODE[nation.toLowerCase()] ?? null;
  return { region: nation, regionCode: code };
}

/**
 * @param {{ country?: string|null, city?: string|null, state?: string|null }} row
 * @returns {{ region: string|null, region_code: string|null }}
 */
export function deriveRegionFields(row) {
  const country = (row.country ?? "US").trim().toUpperCase();
  const state = row.state?.trim() ?? "";
  const city = row.city?.trim() ?? "";

  if (country === "GB" || country === "UK") {
    const { region, regionCode } = resolveGbNation(city, state);
    return { region, region_code: regionCode };
  }

  const abbr = stateToAbbr(state);
  if (!abbr) {
    return {
      region: state || null,
      region_code: state ? slugifySegment(state) : null,
    };
  }
  return {
    region: stateAbbrToDisplayName(abbr),
    region_code: stateNameToSlug(state),
  };
}
