/**
 * Country detection and UK locality normalization for Maps NDJSON rows.
 */

import { pick } from "./scrape-pipeline/index.mjs";

const US_STATE_NAME_KEYS = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
  "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey",
  "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
  "south dakota", "tennessee", "texas", "utah", "vermont", "virginia",
  "washington", "west virginia", "wisconsin", "wyoming", "district of columbia",
]);

const US_STATE_ABBRS = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il",
  "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt",
  "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri",
  "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy", "dc",
]);

function isLikelyUsState(value) {
  if (value == null) return false;
  const key = String(value).trim().toLowerCase().replace(/\./g, "");
  if (!key) return false;
  if (key.length === 2 && US_STATE_ABBRS.has(key)) return true;
  return US_STATE_NAME_KEYS.has(key);
}

export const COUNTRY_US = "US";
export const COUNTRY_GB = "GB";

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

const UK_NATION_NAMES = new Set([
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "uk",
  "united kingdom",
  "great britain",
]);

/** Counties / areas that imply a UK nation when `state` is not already a nation name. */
const UK_SCOTLAND_HINTS = new Set([
  "scotland",
  "glasgow city",
  "city of edinburgh",
  "highland",
  "aberdeenshire",
  "fife",
  "dundee city",
]);

const UK_WALES_HINTS = new Set([
  "wales",
  "cardiff",
  "swansea",
  "newport",
  "gwynedd",
  "powys",
]);

const UK_NI_HINTS = new Set([
  "northern ireland",
  "belfast",
  "county antrim",
  "county down",
  "county londonderry",
  "county tyrone",
]);

export const UK_REGION_SLUG_TO_NAME = {
  england: "England",
  scotland: "Scotland",
  wales: "Wales",
  "northern-ireland": "Northern Ireland",
};

const UK_REGION_NAME_TO_SLUG = Object.fromEntries(
  Object.entries(UK_REGION_SLUG_TO_NAME).map(([slug, name]) => [
    name.toLowerCase(),
    slug,
  ]),
);

function titleCaseWords(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .map((w) => (w ? `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}` : w))
    .join(" ");
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeUkPostcode(value) {
  if (value == null) return null;
  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, "");
  const m = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/i);
  if (!m) return raw.length <= 12 ? raw : null;
  return `${m[1]} ${m[2]}`;
}

/**
 * @param {string|null|undefined} postcode
 * @returns {boolean}
 */
export function looksLikeUkPostcode(postcode) {
  if (!postcode) return false;
  const n = normalizeUkPostcode(postcode);
  return n != null && UK_POSTCODE_RE.test(n);
}

/**
 * Map nation, county, or area string to canonical UK nation name.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeUkRegion(value) {
  if (value == null) return null;
  const key = String(value).trim().toLowerCase().replace(/\./g, "");
  if (!key) return null;

  if (key === "england") return "England";
  const regionSlug = UK_REGION_NAME_TO_SLUG[key];
  if (regionSlug) return UK_REGION_SLUG_TO_NAME[regionSlug];
  if (UK_NATION_NAMES.has(key)) {
    if (key === "uk" || key === "united kingdom" || key === "great britain") {
      return "England";
    }
    return titleCaseWords(key);
  }
  if (UK_SCOTLAND_HINTS.has(key) || key.includes("scotland")) return "Scotland";
  if (UK_WALES_HINTS.has(key) || key.includes("wales")) return "Wales";
  if (UK_NI_HINTS.has(key) || key.includes("northern ireland")) {
    return "Northern Ireland";
  }

  // English counties / metropolitan areas default to England
  if (
    key.includes("greater ") ||
    key.includes("county") ||
    key.includes("shire") ||
    key.includes("london") ||
    key.includes("manchester") ||
    key.includes("yorkshire")
  ) {
    return "England";
  }

  return "England";
}

/**
 * @param {string|null|undefined} raw
 * @returns {typeof COUNTRY_US | typeof COUNTRY_GB | null}
 */
export function parseCountryCode(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;
  if (s === "US" || s === "USA" || s === "UNITED STATES") return COUNTRY_US;
  if (
    s === "GB" ||
    s === "UK" ||
    s === "GBR" ||
    s === "UNITED KINGDOM" ||
    s === "GREAT BRITAIN"
  ) {
    return COUNTRY_GB;
  }
  return null;
}

/**
 * @param {object} row
 * @param {object} base — rowToBusiness result (may lack country)
 * @param {string|null|undefined} [forcedCountry]
 * @returns {typeof COUNTRY_US | typeof COUNTRY_GB}
 */
export function detectCountryFromRow(row, base, forcedCountry) {
  const forced = parseCountryCode(forcedCountry);
  if (forced) return forced;

  const fromRow = parseCountryCode(
    pick(row, "country", "COUNTRY", "country_code", "COUNTRY_CODE"),
  );
  if (fromRow) return fromRow;

  const da = pick(row, "detailed_address", "DETAILED_ADDRESS", "detailedAddress");
  if (da && typeof da === "object") {
    const fromDa = parseCountryCode(
      pick(da, "country", "country_code", "COUNTRY", "COUNTRY_CODE"),
    );
    if (fromDa) return fromDa;
  }

  if (looksLikeUkPostcode(base.postal_code)) return COUNTRY_GB;

  const st = base.state != null ? String(base.state).trim().toLowerCase() : "";
  if (st && UK_NATION_NAMES.has(st)) return COUNTRY_GB;
  if (st && normalizeUkRegion(st)) {
    const nation = normalizeUkRegion(st);
    if (nation && UK_REGION_NAME_TO_SLUG[nation.toLowerCase()]) return COUNTRY_GB;
  }

  if (base.state && isLikelyUsState(base.state)) return COUNTRY_US;

  return COUNTRY_US;
}

/**
 * @param {string|null|undefined} formatted
 * @returns {{ city: string|null, state: string|null, postal_code: string|null }}
 */
export function parseUkLocalityFromFormattedAddress(formatted) {
  const out = { city: null, state: null, postal_code: null };
  if (formatted == null || typeof formatted !== "string") return out;

  const parts = formatted
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return out;

  const last = parts[parts.length - 1];
  const postcodeMatch = last.match(UK_POSTCODE_RE);
  if (postcodeMatch) {
    out.postal_code = normalizeUkPostcode(postcodeMatch[0]);
    const before = parts[parts.length - 2];
    if (before) {
      const region = normalizeUkRegion(before);
      if (region) out.state = region;
      else out.city = titleCaseWords(before);
    }
    if (parts.length >= 3 && !out.city) {
      out.city = titleCaseWords(parts[parts.length - 3]);
    }
    return out;
  }

  const region = normalizeUkRegion(last);
  if (region && UK_REGION_NAME_TO_SLUG[region.toLowerCase()]) {
    out.state = region;
    out.city = titleCaseWords(parts[parts.length - 2]);
    return out;
  }

  return out;
}

/**
 * @param {string} regionSlug
 * @returns {string|null}
 */
export function ukRegionSlugToName(regionSlug) {
  return UK_REGION_SLUG_TO_NAME[regionSlug.trim().toLowerCase()] ?? null;
}

/**
 * @param {string} state — nation name e.g. England
 * @returns {string|null}
 */
export function ukRegionNameToSlug(state) {
  return UK_REGION_NAME_TO_SLUG[state.trim().toLowerCase()] ?? null;
}
