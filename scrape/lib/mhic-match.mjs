/**
 * MHIC name/geo matching for Maryland contractor license enrichment.
 */

const ENTITY_SUFFIX_RE =
  /\b(?:l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|co\.?|company|pllc\.?|p\.?c\.?|p\.?a\.?|llp\.?|d\/?b\/?a|dba)\b\.?/gi;

const LEADING_THE_RE = /^\s*the\s+/i;

const WEAK_TOKENS = new Set([
  "the",
  "and",
  "of",
  "a",
  "an",
  "llc",
  "inc",
  "corp",
  "ltd",
  "co",
  "company",
  "services",
  "service",
]);

const SUFFIX_NAME_TOKENS = new Set([
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "v",
  "phd",
  "md",
]);

export const NAME_SIMILARITY_THRESHOLD = 0.65;
export const NAME_TOKEN_OVERLAP_THRESHOLD = 0.55;

export const MHIC_CONTRACTOR_SLUGS = [
  "contractor",
  "general-contractor",
  "remodeler",
  "bathroom-remodeler",
  "kitchen-remodeler",
  "handyman",
  "handyman-handywoman-handyperson",
  "roofer",
  "siding-contractor",
  "deck-builder",
  "custom-home-builder",
  "home-builder",
  "construction-company",
  "building-firm",
  "carpenter",
  "painter",
  "dry-wall-contractor",
  "flooring-contractor",
  "insulation-contractor",
  "masonry-contractor",
  "paving-contractor",
  "tile-contractor",
  "window-installation-service",
  "gutter-service",
  "concrete-contractor",
  "fence-contractor",
  "swimming-pool-contractor",
  "demolition-contractor",
  "building-restoration-service",
  "waterproofing-service",
];

export function zip5(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

export function normalizeCity(value) {
  if (value == null) return "";
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(city|town|township|borough)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function citiesAgree(a, b) {
  const left = normalizeCity(a);
  const right = normalizeCity(b);
  return Boolean(left && right && left === right);
}

export function stripEntitySuffixes(value) {
  if (value == null) return "";
  let next = String(value).replace(LEADING_THE_RE, "");
  next = next.replace(ENTITY_SUFFIX_RE, " ");
  next = next.replace(/[.,/#'"]/g, " ").replace(/\s+/g, " ").trim();
  return next;
}

export function businessNameQuery(value) {
  const stripped = stripEntitySuffixes(value);
  return stripped.length >= 3 ? stripped : "";
}

export function ownerLastName(value) {
  if (value == null) return "";
  const tokens = stripEntitySuffixes(value)
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z'-]/g, ""))
    .filter((t) => t.length >= 2 && !SUFFIX_NAME_TOKENS.has(t.toLowerCase()));
  if (tokens.length === 0) return "";
  return tokens[tokens.length - 1];
}

export function normalizeName(value) {
  return stripEntitySuffixes(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenizeName(value) {
  const normalized = normalizeName(value);
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t.length >= 2 && !WEAK_TOKENS.has(t));
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array(cols);
  const curr = new Array(cols);
  for (let j = 0; j < cols; j += 1) prev[j] = j;
  for (let i = 1; i < rows; i += 1) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j < cols; j += 1) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function similarityRatio(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(left, right) / maxLen;
}

export function tokenOverlapScore(a, b) {
  const left = new Set(tokenizeName(a));
  const right = new Set(tokenizeName(b));
  if (left.size === 0 || right.size === 0) return 0;
  let inter = 0;
  for (const token of left) {
    if (right.has(token)) inter += 1;
  }
  return inter / Math.min(left.size, right.size);
}

export function nameScore(a, b) {
  if (!a || !b) return 0;
  return Math.max(similarityRatio(a, b), tokenOverlapScore(a, b));
}

export function namesFuzzyMatch(a, b) {
  if (!a || !b) return false;
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left.length < 3 || right.length < 3) return left === right;
  const sim = similarityRatio(left, right);
  const overlap = tokenOverlapScore(left, right);
  return sim >= NAME_SIMILARITY_THRESHOLD || overlap >= NAME_TOKEN_OVERLAP_THRESHOLD;
}

export function isContractorCategory(category) {
  return /contractor/i.test(String(category ?? ""));
}

export function isSalespersonOnlyCategory(category) {
  const raw = String(category ?? "");
  return /sales/i.test(raw) && !/contractor/i.test(raw);
}

export function licenseNumberOf(hit) {
  const raw = hit?.licenseNumber ?? hit?.license_number ?? "";
  const trimmed = String(raw).trim();
  return trimmed && !/^n\/?a$/i.test(trimmed) ? trimmed : "";
}

export function suffixOf(hit) {
  const raw = String(hit?.suffix ?? "").trim();
  if (!raw || /^n\/?a$/i.test(raw)) return null;
  return raw;
}

function hitNameMatchesBusiness(hit, businessName, ownerName) {
  const trade = hit?.tradeName ?? hit?.trade_name ?? "";
  const legal = hit?.name ?? "";
  const against = [businessName, ownerName].filter(Boolean);
  for (const candidate of against) {
    if (namesFuzzyMatch(trade, candidate) || namesFuzzyMatch(legal, candidate)) {
      return true;
    }
  }
  return false;
}

function geoAgrees(hit, city, postalCode) {
  const hitZip = zip5(hit?.zip);
  const ourZip = zip5(postalCode);
  if (hitZip && ourZip && hitZip === ourZip) return true;
  if (citiesAgree(hit?.city, city)) return true;
  return false;
}

function bestNameScore(hit, businessName, ownerName) {
  const trade = hit?.tradeName ?? hit?.trade_name ?? "";
  const legal = hit?.name ?? "";
  let best = 0;
  for (const candidate of [businessName, ownerName].filter(Boolean)) {
    best = Math.max(best, nameScore(trade, candidate), nameScore(legal, candidate));
  }
  return best;
}

/**
 * Pick the best confident MHIC hit. Never invent a row from leftovers.
 * @returns {object | null}
 */
export function pickConfidentMhicMatch(hits, { businessName, ownerName, city, postalCode }) {
  const passed = [];
  for (const hit of hits ?? []) {
    if (!licenseNumberOf(hit)) continue;
    if (!hitNameMatchesBusiness(hit, businessName, ownerName)) continue;
    if (!geoAgrees(hit, city, postalCode)) continue;
    passed.push(hit);
  }
  if (passed.length === 0) return null;

  const ourZip = zip5(postalCode);
  passed.sort((a, b) => {
    const aContractor = isContractorCategory(a.category) ? 1 : 0;
    const bContractor = isContractorCategory(b.category) ? 1 : 0;
    if (bContractor !== aContractor) return bContractor - aContractor;

    const aSales = isSalespersonOnlyCategory(a.category) ? 1 : 0;
    const bSales = isSalespersonOnlyCategory(b.category) ? 1 : 0;
    if (aSales !== bSales) return aSales - bSales;

    const nameDiff =
      bestNameScore(b, businessName, ownerName) - bestNameScore(a, businessName, ownerName);
    if (nameDiff !== 0) return nameDiff;

    const aZip = ourZip && zip5(a.zip) === ourZip ? 1 : 0;
    const bZip = ourZip && zip5(b.zip) === ourZip ? 1 : 0;
    return bZip - aZip;
  });

  return passed[0];
}

export function mhicRowPatch(hit, { matched }) {
  const checkedAt = new Date().toISOString();
  if (!matched || !hit) {
    return {
      mhic_match: false,
      mhic_license_number: null,
      mhic_suffix: null,
      mhic_legal_name: null,
      mhic_trade_name: null,
      mhic_category: null,
      mhic_expiration_date: null,
      mhic_address: null,
      mhic_city: null,
      mhic_state: null,
      mhic_zip: null,
      mhic_checked_at: checkedAt,
    };
  }

  const expiration = String(hit.expirationDate ?? hit.expiration_date ?? "").trim();
  return {
    mhic_match: true,
    mhic_license_number: licenseNumberOf(hit),
    mhic_suffix: suffixOf(hit),
    mhic_legal_name: String(hit.name ?? "").trim() || null,
    mhic_trade_name: String(hit.tradeName ?? hit.trade_name ?? "").trim() || null,
    mhic_category: String(hit.category ?? "").trim() || null,
    mhic_expiration_date: /^\d{4}-\d{2}-\d{2}$/.test(expiration) ? expiration : null,
    mhic_address: String(hit.address ?? "").trim() || null,
    mhic_city: String(hit.city ?? "").trim() || null,
    mhic_state: String(hit.state ?? "").trim() || null,
    mhic_zip: zip5(hit.zip),
    mhic_checked_at: checkedAt,
  };
}
