/**
 * City / state / ZIP fallbacks when Maps NDJSON lacks structured detailed_address.
 */

import { pick } from "./scrape-pipeline/index.mjs";
import {
  COUNTRY_AU,
  COUNTRY_GB,
  COUNTRY_US,
  detectCountryFromRow,
  looksLikeAuPostcode,
  looksLikeUkPostcode,
  normalizeAuPostcode,
  normalizeAuStateName,
  normalizeUkPostcode,
  normalizeUkRegion,
  parseAuLocalityFromFormattedAddress,
  parseUkLocalityFromFormattedAddress,
} from "./country.mjs";

const CENSUS_COORD_GEOGRAPHIES_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

const STATE_NAME_TO_ABBR = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

const STATE_ABBR_TO_NAME = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [
    abbr,
    name
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  ]),
);

/** @type {Map<string, { city: string, state: string } | null>} */
const zipLookupCache = new Map();

function titleCaseWords(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .map((w) => (w ? `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}` : w))
    .join(" ");
}

/** Street/district numbers mis-parsed as city (e.g. "8", "1, Fork"). */
export function isLikelyBadUsCity(city) {
  if (city == null) return false;
  const raw = String(city).trim();
  if (!raw) return false;
  if (/^\d+$/.test(raw)) return true;
  if (/^\d+\s*,\s*.+$/.test(raw)) return true;
  return false;
}

/**
 * Strip census/district prefixes like "1, Fork" → "Fork"; reject numeric-only cities.
 * @param {string|null|undefined} city
 * @returns {string|null}
 */
export function sanitizeParsedUsCity(city) {
  if (city == null) return null;
  const raw = String(city).trim();
  if (!raw) return null;

  const districtPrefix = raw.match(/^(\d+)\s*,\s*(.+)$/);
  if (districtPrefix) {
    const rest = districtPrefix[2].trim();
    if (rest && !/^\d+$/.test(rest)) {
      return titleCaseWords(rest);
    }
    return null;
  }

  if (/^\d+$/.test(raw)) return null;
  return titleCaseWords(raw);
}

/**
 * Normalize to full state name (e.g. "CA" → "California") for DB consistency.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeUsStateName(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.length === 2) {
    const full = STATE_ABBR_TO_NAME[raw.toUpperCase()];
    return full ?? raw.toUpperCase();
  }
  const key = raw.toLowerCase().replace(/\./g, "");
  const abbr = STATE_NAME_TO_ABBR[key];
  if (abbr) {
    return STATE_ABBR_TO_NAME[abbr];
  }
  return titleCaseWords(raw);
}

/**
 * Parse US-style trailing "City, ST 12345" from a formatted address string.
 * @param {string|null|undefined} formatted
 * @returns {{ city: string|null, state: string|null, postal_code: string|null }}
 */
export function parseCityStateFromFormattedAddress(formatted) {
  const out = { city: null, state: null, postal_code: null };
  if (formatted == null || typeof formatted !== "string") return out;

  const parts = formatted
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return out;

  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];

  const zipOnly = last.match(/^(\d{5})(?:-\d{4})?$/);
  if (zipOnly && parts.length >= 3) {
    out.postal_code = zipOnly[1];
    out.state = normalizeUsStateName(prev);
    out.city = sanitizeParsedUsCity(parts[parts.length - 3]);
    return out;
  }

  const stateZip = last.match(/^(.+?)\s+(\d{5})(?:-\d{4})?$/);
  if (stateZip) {
    out.state = normalizeUsStateName(stateZip[1].trim());
    out.postal_code = stateZip[2];
    out.city = sanitizeParsedUsCity(prev);
    return out;
  }

  if (/^[A-Za-z]{2}$/.test(last)) {
    out.state = normalizeUsStateName(last);
    out.city =
      sanitizeParsedUsCity(prev) ??
      (parts.length >= 3 ? sanitizeParsedUsCity(parts[parts.length - 3]) : null);
    return out;
  }

  if (!/^\d/.test(last)) {
    const stateKey = last.toLowerCase().replace(/\./g, "");
    if (STATE_NAME_TO_ABBR[stateKey] || last.length === 2) {
      out.state = normalizeUsStateName(last);
      out.city =
        sanitizeParsedUsCity(prev) ??
        (parts.length >= 3 ? sanitizeParsedUsCity(parts[parts.length - 3]) : null);
    }
  }

  return out;
}

function isUsableGeoPlaceName(name) {
  if (name == null) return false;
  const raw = String(name).trim();
  if (!raw) return false;
  if (/^\d+$/.test(raw)) return false;
  if (/^\d+\s*,/.test(raw)) return false;
  return true;
}

function firstGeoName(geos, layerPattern) {
  if (!geos || typeof geos !== "object") return null;
  for (const layerName of Object.keys(geos)) {
    if (!layerPattern.test(layerName)) continue;
    const arr = geos[layerName];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const row = arr[0];
    const name =
      row.BASENAME ?? row.NAME ?? row.PLACE_NAME ?? row.COUNTY_NAME ?? null;
    if (name != null && isUsableGeoPlaceName(name)) {
      return String(name).trim();
    }
  }
  return null;
}

function stateFromCensusGeos(geos) {
  const states = geos?.States;
  if (!Array.isArray(states) || states.length === 0) return null;
  const row = states[0];
  const abbr = row.STUSAB ?? row.STUSPS ?? row.STATE_ABBR ?? null;
  if (abbr) return normalizeUsStateName(String(abbr));
  const name = row.NAME ?? row.STATE_NAME ?? null;
  return name ? normalizeUsStateName(String(name)) : null;
}

function cityFromCensusGeos(geos) {
  return (
    firstGeoName(geos, /Incorporated Places/i) ??
    firstGeoName(geos, /Census Designated Places/i) ??
    firstGeoName(geos, /County Subdivision/i) ??
    firstGeoName(geos, /Counties/i)
  );
}

function zipFromCensusGeos(geos) {
  if (!geos || typeof geos !== "object") return null;
  for (const layerName of Object.keys(geos)) {
    if (!/ZCTA|ZIP Code Tabulation/i.test(layerName)) continue;
    const arr = geos[layerName];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const row = arr[0];
    const raw =
      row.ZCTA5CE20 ??
      row.ZCTA5CE10 ??
      row.GEOID ??
      row.BASENAME ??
      row.NAME ??
      null;
    if (raw == null) continue;
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length >= 5) return digits.slice(0, 5);
    if (digits.length >= 3) return digits.padStart(5, "0");
  }
  return null;
}

/**
 * @param {number|string} longitude
 * @param {number|string} latitude
 * @returns {Promise<{ city: string|null, state: string|null, postal_code: string|null }>}
 */
export async function reverseGeocodeLocalityCensus(longitude, latitude) {
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return { city: null, state: null, postal_code: null };
  }

  const params = new URLSearchParams({
    x: String(lon),
    y: String(lat),
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json",
  });

  try {
    const res = await fetch(`${CENSUS_COORD_GEOGRAPHIES_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "nowebsite-location-fallbacks/1.0",
      },
    });
    if (!res.ok) {
      return { city: null, state: null, postal_code: null };
    }
    const data = await res.json();
    const geos = data?.result?.geographies;
    const cityRaw = cityFromCensusGeos(geos);
    return {
      city: cityRaw ? titleCaseWords(cityRaw) : null,
      state: stateFromCensusGeos(geos),
      postal_code: zipFromCensusGeos(geos),
    };
  } catch {
    return { city: null, state: null, postal_code: null };
  }
}

/**
 * @param {string} zip — 5-digit US ZIP
 * @returns {Promise<{ city: string|null, state: string|null } | null>}
 */
export async function lookupCityStateByZip(zip) {
  const digits = String(zip ?? "").replace(/\D/g, "").slice(0, 5);
  if (digits.length !== 5) return null;

  if (zipLookupCache.has(digits)) {
    return zipLookupCache.get(digits) ?? null;
  }

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${digits}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      zipLookupCache.set(digits, null);
      return null;
    }
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) {
      zipLookupCache.set(digits, null);
      return null;
    }
    const result = {
      city: place["place name"]
        ? titleCaseWords(String(place["place name"]))
        : null,
      state: normalizeUsStateName(
        place["state abbreviation"] ?? place.state ?? null,
      ),
    };
    zipLookupCache.set(digits, result);
    return result;
  } catch {
    zipLookupCache.set(digits, null);
    return null;
  }
}

function normalizeLocationByCountry(base) {
  if (base.country === COUNTRY_GB) {
    if (base.state) base.state = normalizeUkRegion(base.state);
    if (base.postal_code) {
      base.postal_code = normalizeUkPostcode(base.postal_code) ?? base.postal_code;
    }
    return base;
  }
  if (base.country === COUNTRY_AU) {
    if (base.state) base.state = normalizeAuStateName(base.state) ?? base.state;
    if (base.postal_code) {
      base.postal_code = normalizeAuPostcode(base.postal_code) ?? base.postal_code;
    }
    return base;
  }
  if (base.state) base.state = normalizeUsStateName(base.state);
  if (base.city) {
    base.city = sanitizeParsedUsCity(base.city);
  }
  if (base.postal_code) {
    const d = String(base.postal_code).replace(/\D/g, "").slice(0, 5);
    base.postal_code = d.length === 5 ? d : base.postal_code;
  }
  return base;
}

/**
 * Sync fallbacks: top-level row fields + parse formatted address strings.
 * Mutates and returns `base` (sets `base.country`).
 * @param {object} base — rowToBusiness result
 * @param {object} row — raw NDJSON row
 * @param {{ forcedCountry?: string|null }} [opts]
 */
export function applyLocationFallbacks(base, row, opts = {}) {
  if (!base.city) {
    base.city =
      pick(row, "city", "CITY", "locality", "LOCALITY", "town", "TOWN") ?? null;
    if (base.city) base.city = titleCaseWords(String(base.city));
  }
  if (!base.state) {
    base.state =
      pick(
        row,
        "state",
        "STATE",
        "state_code",
        "STATE_CODE",
        "region",
        "REGION",
        "administrative_area",
        "ADMINISTRATIVE_AREA",
      ) ?? null;
    if (base.state) base.state = String(base.state).trim();
  }
  if (!base.postal_code) {
    base.postal_code =
      pick(row, "postal_code", "POSTAL_CODE", "zip", "ZIP", "zip_code", "ZIP_CODE") ??
      null;
  }

  const preCountry = detectCountryFromRow(row, base, opts.forcedCountry);
  const preferUk =
    preCountry === COUNTRY_GB ||
    looksLikeUkPostcode(base.postal_code);
  const preferAu =
    preCountry === COUNTRY_AU ||
    looksLikeAuPostcode(base.postal_code);

  const formattedCandidates = [
    base.address,
    pick(row, "address", "ADDRESS"),
    pick(row, "formatted_address", "FORMATTED_ADDRESS", "full_address", "FULL_ADDRESS"),
  ].filter((v) => v != null && String(v).trim());

  const seen = new Set();
  for (const candidate of formattedCandidates) {
    const s = String(candidate).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    const parsed = preferUk
      ? parseUkLocalityFromFormattedAddress(s)
      : preferAu
        ? parseAuLocalityFromFormattedAddress(s)
        : parseCityStateFromFormattedAddress(s);
    if (!base.city && parsed.city) base.city = parsed.city;
    if (!base.state && parsed.state) base.state = parsed.state;
    if (!base.postal_code && parsed.postal_code) {
      base.postal_code = parsed.postal_code;
    }
    if (base.city && base.state) break;
  }

  base.country = detectCountryFromRow(row, base, opts.forcedCountry);
  return normalizeLocationByCountry(base);
}

/**
 * Async fallbacks: Census coordinates, then ZIP lookup (scrape job or postal_code).
 * Skips US geocoding for GB rows.
 * Mutates and returns `base`.
 * @param {object} base
 * @param {{ scrapeZip?: string|null, locationHint?: string|null, country?: string|null, forcedCountry?: string|null }} [opts]
 */
export async function enrichLocationAsync(base, opts = {}) {
  if (!base.country) {
    base.country = opts.country ?? COUNTRY_US;
  }

  const locationHint =
    opts.locationHint?.trim() || opts.scrapeZip?.trim() || null;

  if (base.country === COUNTRY_GB || opts.forcedCountry === COUNTRY_GB) {
    base.country = COUNTRY_GB;
    if (!base.postal_code && locationHint && looksLikeUkPostcode(locationHint)) {
      base.postal_code = normalizeUkPostcode(locationHint);
    }
    return normalizeLocationByCountry(base);
  }

  if (base.country === COUNTRY_AU || opts.forcedCountry === COUNTRY_AU) {
    base.country = COUNTRY_AU;
    if (!base.postal_code && locationHint && looksLikeAuPostcode(locationHint)) {
      base.postal_code = normalizeAuPostcode(locationHint);
    }
    return normalizeLocationByCountry(base);
  }

  const needsCity = !base.city || isLikelyBadUsCity(base.city);
  const needsState = !base.state;
  const needsZip = !base.postal_code;

  if ((needsCity || needsState || needsZip) && base.latitude != null && base.longitude != null) {
    const geo = await reverseGeocodeLocalityCensus(base.longitude, base.latitude);
    if (needsCity && geo.city) base.city = geo.city;
    if (!base.state && geo.state) base.state = geo.state;
    if (!base.postal_code && geo.postal_code) base.postal_code = geo.postal_code;
  }

  const zipHint =
    locationHint ||
    (base.postal_code ? String(base.postal_code).replace(/\D/g, "").slice(0, 5) : "");
  if ((!base.city || !base.state) && zipHint.length === 5 && /^\d{5}$/.test(zipHint)) {
    const fromZip = await lookupCityStateByZip(zipHint);
    if (fromZip) {
      if (!base.city && fromZip.city) base.city = fromZip.city;
      if (!base.state && fromZip.state) base.state = fromZip.state;
      if (!base.postal_code) base.postal_code = zipHint;
    }
  }

  if (!base.city || isLikelyBadUsCity(base.city)) {
    base.city = null;
  }
  return normalizeLocationByCountry(base);
}
