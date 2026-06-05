/**
 * Build Supabase `businesses` upsert payloads from raw google_maps_scraper rows.
 * Logic aligned with scrape/pipeline.mjs (minus OpenRouter weakness / category).
 */

import { pick, toNum, omitUndefined } from "./scrape-pipeline/index.mjs";
import { reverseGeocodeLocalityCensus } from "./location-fallbacks.mjs";
import { deriveRegionFields } from "./region-fields.mjs";
import {
  sanitizeJsonColumn,
  truncateForJson,
} from "./json-column-sanitize.mjs";

/**
 * @param {number|string} longitude
 * @param {number|string} latitude
 * @returns {Promise<string|null>} 5-digit ZIP/ZCTA or null
 */
export async function reverseGeocodeZipCensus(longitude, latitude) {
  const geo = await reverseGeocodeLocalityCensus(longitude, latitude);
  return geo.postal_code;
}

function textToTokens(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/&-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeServiceLabel(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** `business_type` fallback from extract-local; must never appear as a service bullet. */
function isPlaceholderServiceNormalized(n) {
  return n.replace(/_+/g, " ").trim() === "local cache";
}

function titleCase(s) {
  return String(s ?? "")
    .split(" ")
    .map((w) => (w ? `${w[0].toUpperCase()}${w.slice(1)}` : w))
    .join(" ");
}

function pickReviewContainers(row) {
  const candidates = [
    pick(row, "featured_reviews", "FEATURED_REVIEWS"),
    pick(row, "reviews_data", "REVIEWS_DATA"),
    pick(row, "reviews", "REVIEWS"),
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

/**
 * @param {object} row
 * @param {number} [max]
 */
export function extractReviewHighlights(row, max = 5) {
  const reviews = pickReviewContainers(row);
  if (!reviews.length) return null;
  const minLen = Number(process.env.REVIEW_HIGHLIGHT_MIN_CHARS ?? 80);
  const maxLen = Number(process.env.REVIEW_HIGHLIGHT_MAX_CHARS ?? 700);
  const out = [];
  const seen = new Set();
  const scored = [];

  for (const rev of reviews) {
    const rating = toNum(pick(rev, "rating", "RATING"));
    const txt = pick(rev, "review_text", "text", "reviewText", "comment");
    const relTime = pick(rev, "review_time", "time", "relative_time", "date");
    const reviewer = pick(
      rev,
      "reviewer_name",
      "author_name",
      "author",
      "user_name",
      "name",
    );
    if (!txt || rating == null) continue;
    const t = String(txt).replace(/\s+/g, " ").trim();
    if (t.length < minLen) continue;
    const excerpt = truncateForJson(t, maxLen);
    const key = excerpt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const score = rating >= 5 ? 2 : rating >= 4 ? 1 : 0;
    scored.push({
      score,
      item: omitUndefined({
        rating: Number(rating),
        excerpt,
        relative_time: relTime ? String(relTime) : undefined,
        reviewer_name: reviewer ? String(reviewer).trim() : undefined,
      }),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  for (const s of scored) {
    out.push(s.item);
    if (out.length >= max) break;
  }

  return out.length ? out : null;
}

/**
 * @param {object} raw
 * @param {object} base
 */
export function extractServicesOffered(raw, base) {
  const candidates = [];
  const cats = pick(raw, "categories", "CATEGORIES");
  if (Array.isArray(cats)) {
    candidates.push(...cats.map(String));
  } else if (cats) {
    candidates.push(String(cats));
  }
  if (base.main_category) candidates.push(String(base.main_category));
  if (base.business_type) candidates.push(String(base.business_type));

  const reviews = pickReviewContainers(raw);
  for (const rev of reviews.slice(0, 15)) {
    const txt = pick(rev, "review_text", "text", "reviewText");
    if (!txt) continue;
    const tokens = textToTokens(txt);
    const joined = tokens.join(" ");
    const hints = [
      "installation",
      "repair",
      "maintenance",
      "cleaning",
      "detailing",
      "painting",
      "grooming",
      "inspection",
    ];
    for (const h of hints) {
      if (joined.includes(h)) candidates.push(h);
    }
  }

  const uniq = [];
  const seen = new Set();
  for (const c of candidates) {
    const n = normalizeServiceLabel(c);
    if (!n || n.length < 3) continue;
    if (isPlaceholderServiceNormalized(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    uniq.push(titleCase(n));
    if (uniq.length >= 12) break;
  }
  return uniq.length ? uniq : null;
}

/** @param {object} raw */
export function extractHoursData(raw) {
  const hours = pick(
    raw,
    "hours",
    "HOURS",
    "opening_hours",
    "OPENING_HOURS",
    "working_hours",
    "WORKING_HOURS",
  );
  const openNowRaw = pick(raw, "open_now", "OPEN_NOW", "is_open", "IS_OPEN");

  let open_now = null;
  if (typeof openNowRaw === "boolean") {
    open_now = openNowRaw;
  } else if (openNowRaw != null && String(openNowRaw).trim() !== "") {
    const s = String(openNowRaw).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "open") open_now = true;
    if (s === "false" || s === "0" || s === "no" || s === "closed") open_now = false;
  }

  return {
    hours:
      hours && typeof hours === "object"
        ? hours
        : Array.isArray(hours)
          ? hours
          : null,
    open_now,
  };
}

/**
 * @param {object} raw — google_maps_scraper row
 * @param {object} base — rowToBusiness(...)
 *
 * Always includes demo SEO fields (`review_highlights`, `services_offered`, `hours`, `open_now`,
 * `review_highlights_updated_at`) so rows are immediately eligible for CRM/demo surfaces.
 * Ensure the target table has these columns (see scrape/sql/businesses-demo-seo-fields.sql).
 */
export function buildBusinessUpsertPayload(raw, base) {
  const regionFields = deriveRegionFields({
    country: base.country,
    city: base.city,
    state: base.state,
  });
  const core = omitUndefined({
    ...base,
    ...regionFields,
    facebook_url: base.facebook_url ?? undefined,
  });
  const limit = Number(process.env.REVIEW_HIGHLIGHTS_LIMIT ?? 5);
  const hoursData = extractHoursData(raw);
  return omitUndefined({
    ...core,
    review_highlights: sanitizeJsonColumn(extractReviewHighlights(raw, limit)),
    services_offered: extractServicesOffered(raw, base),
    hours: sanitizeJsonColumn(hoursData.hours),
    open_now: hoursData.open_now,
    review_highlights_updated_at: new Date().toISOString(),
    last_checked: new Date().toISOString(),
  });
}
