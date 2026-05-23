import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import { createClient } from "@supabase/supabase-js";

const FALLBACK_BOTASAURUS_URL = "http://52.15.173.205";

/** Resolved at call time so `loadEnvLocal()` runs before imports use the URL. */
export function getBotasaurusBase() {
  const u = process.env.BOTASAURUS_URL;
  if (u != null && String(u).trim() !== "") {
    return String(u).trim().replace(/\/$/, "");
  }
  return FALLBACK_BOTASAURUS_URL;
}

/**
 * Base URL for long-running POSTs (e.g. `create-task-async`). Set `BOTASAURUS_WRITE_URL`
 * to hit uvicorn directly (e.g. :8000) when Apache on :80 returns 408/502 for slow requests.
 */
export function getBotasaurusWriteBase() {
  const w = process.env.BOTASAURUS_WRITE_URL;
  if (w != null && String(w).trim() !== "") {
    return String(w).trim().replace(/\/$/, "");
  }
  return getBotasaurusBase();
}

/** @deprecated Use getBotasaurusBase() after loading env — this is fixed at module load and often wrong. */
export const BOTASAURUS_BASE = FALLBACK_BOTASAURUS_URL;

/** Optional Bearer token for hosted Botasaurus (same JWT as GOOGLE_MAPS_EXTRACTOR_KEY in some setups). */
export function botasaurusAuthHeaders() {
  const t = process.env.BOTASAURUS_AUTH_TOKEN ?? process.env.GOOGLE_MAPS_EXTRACTOR_KEY;
  if (!t) return {};
  return { Authorization: `Bearer ${String(t).trim()}` };
}

/** Long-lived agent so GET /tasks/:id (slow while work runs) does not hit Undici's default headers timeout. */
let botasaurusAgent = null;

function getBotasaurusAgent() {
  if (botasaurusAgent) return botasaurusAgent;
  const headersTimeout =
    Number.parseInt(process.env.BOTASAURUS_HEADERS_TIMEOUT_MS ?? "3600000", 10) || 3_600_000;
  const bodyTimeout =
    Number.parseInt(process.env.BOTASAURUS_BODY_TIMEOUT_MS ?? "3600000", 10) || 3_600_000;
  const connectTimeout =
    Number.parseInt(process.env.BOTASAURUS_CONNECT_TIMEOUT_MS ?? "120000", 10) || 120_000;
  botasaurusAgent = new Agent({
    headersTimeout,
    bodyTimeout,
    connectTimeout,
  });
  return botasaurusAgent;
}

export async function botasaurusFetch(pathOrUrl, init = {}) {
  const base = getBotasaurusBase();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${base.replace(/\/$/, "")}/${pathOrUrl.replace(/^\//, "")}`;
  const { dispatcher: explicitDispatcher, headers: userHeaders, ...rest } = init;
  const headers = {
    Accept: "application/json",
    ...botasaurusAuthHeaders(),
    ...userHeaders,
  };
  return undiciFetch(url, {
    ...rest,
    headers,
    dispatcher: explicitDispatcher ?? getBotasaurusAgent(),
  });
}

export function loadEnvLocal() {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "..", ".env.local"),
  ];
  const p = candidates.find((f) => existsSync(f));
  if (!p) {
    throw new Error(
      "Missing .env.local (checked cwd and parent). Run from repo root or scrape/ with .env.local present.",
    );
  }
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
    );
  }
  return createClient(url, key);
}

export function parseBusinessTypeArg(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const m =
      /^--business_type=(.*)$/.exec(arg) ?? /^--business-type=(.*)$/.exec(arg);
    if (m) {
      let v = m[1].replace(/^['"]|['"]$/g, "").trim();
      let j = i + 1;
      while (j < args.length && !args[j].startsWith("--")) {
        v += ` ${args[j]}`;
        j += 1;
      }
      return v.trim();
    }
    if (arg === "--business_type" || arg === "--business-type") {
      let j = i + 1;
      const parts = [];
      while (j < args.length && !args[j].startsWith("--")) {
        parts.push(args[j]);
        j += 1;
      }
      return parts.join(" ").replace(/^['"]|['"]$/g, "").trim();
    }
  }
  return "";
}

export function parseStateArg(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const m = /^--state=(.*)$/i.exec(arg);
    if (m) {
      return m[1].replace(/^['"]|['"]$/g, "").trim().toUpperCase();
    }
    if (/^--state$/i.test(arg) && args[i + 1] && !args[i + 1].startsWith("--")) {
      return args[i + 1].replace(/^['"]|['"]$/g, "").trim().toUpperCase();
    }
  }
  return null;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableBotasaurusCreateError(status, message) {
  if (Number.isFinite(status) && [408, 502, 503, 504].includes(status)) return true;
  const m = String(message ?? "");
  return /fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket/i.test(m);
}

/**
 * POST `/tasks/create-task-async` with retries. Uses `BOTASAURUS_WRITE_URL` when set
 * (direct backend) so Apache on :80 does not time out long requests.
 * @param {Record<string, unknown>} body e.g. `{ data, scraper_name }`
 */
export async function botasaurusCreateTaskAsync(body) {
  const base = getBotasaurusWriteBase();
  const url = `${base}/tasks/create-task-async`;
  const maxAttempts = Math.max(
    1,
    Number.parseInt(process.env.DISPATCH_CREATE_RETRIES ?? "5", 10) || 5,
  );
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await botasaurusFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (isRetriableBotasaurusCreateError(res.status, text) && attempt < maxAttempts) {
          const wait = Math.min(45_000, 3000 * attempt);
          console.error(
            `botasaurusCreateTaskAsync: HTTP ${res.status} (attempt ${attempt}/${maxAttempts}), retry in ${wait}ms…`,
          );
          await sleep(wait);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return res.json();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const cause =
        e instanceof Error && e.cause != null
          ? e.cause instanceof Error
            ? e.cause.message
            : String(e.cause)
          : "";
      const detail = cause && !msg.includes(cause) ? ` — ${cause}` : "";
      if (isRetriableBotasaurusCreateError(null, msg) && attempt < maxAttempts) {
        const wait = Math.min(45_000, 3000 * attempt);
        console.error(
          `botasaurusCreateTaskAsync: ${msg}${detail} (attempt ${attempt}/${maxAttempts}), retry in ${wait}ms…`,
        );
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
      return row[k];
    }
  }
  return null;
}

export function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function pickDetailedAddress(row) {
  const da = pick(row, "detailed_address", "DETAILED_ADDRESS", "detailedAddress");
  if (!da || typeof da !== "object") {
    return {
      street: null,
      city: null,
      state: null,
      postal_code: null,
    };
  }
  return {
    street:
      pick(da, "street", "street_address", "address", "streetAddress") ?? null,
    city: pick(da, "city", "city_name", "locality") ?? null,
    state:
      pick(da, "state", "state_code", "administrative_area", "administrative_area_level_1") ??
      null,
    postal_code:
      pick(da, "postal_code", "postalCode", "zip", "zip_code", "postal") ?? null,
  };
}

export function pickLatLng(row) {
  const c = pick(row, "coordinates", "COORDINATES");
  if (typeof c === "string") {
    const parts = c.split(/[,\s]+/).filter(Boolean);
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    return {
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    };
  }
  if (c && typeof c === "object") {
    return {
      latitude: toNum(pick(c, "latitude", "lat")),
      longitude: toNum(pick(c, "longitude", "lng", "long")),
    };
  }
  return { latitude: null, longitude: null };
}

export function normalizeFacebookUrl(href) {
  if (!href || typeof href !== "string") return null;
  const s = href.trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (!/facebook\.com|fb\.com|fb\.me/i.test(u.hostname)) {
      return null;
    }
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * True when the Maps "website" field is only a Facebook-family URL (facebook.com, fb.com, fb.me).
 * Those listings should be treated as having no standalone website for lead filtering.
 * @param {string|null|undefined} href
 * @returns {boolean}
 */
export function isFacebookWebsiteField(href) {
  return normalizeFacebookUrl(href != null ? String(href) : "") != null;
}

/**
 * True when the website field is only a WhatsApp link (`wa.me`, `*.whatsapp.com`), e.g.
 * `https://wa.me/c/12404682667` — treat as no standalone website for lead filtering.
 * @param {string|null|undefined} href
 * @returns {boolean}
 */
export function isWhatsAppWebsiteField(href) {
  if (!href || typeof href !== "string") return false;
  const s = href.trim();
  if (!s) return false;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const h = u.hostname.toLowerCase();
    if (h === "wa.me" || h.endsWith(".wa.me")) return true;
    return /(^|\.)whatsapp\.com$/i.test(h);
  } catch {
    return /\bwa\.me\b|whatsapp\.com/i.test(s);
  }
}

/**
 * Google Maps scraper exposes FACEBOOK when website social enrichment runs (enable_emails_social).
 */
export function pickFacebookUrl(row) {
  const direct = pick(row, "facebook", "FACEBOOK");
  let n = normalizeFacebookUrl(direct != null ? String(direct) : "");
  if (n) return n;

  const nested = pick(row, "social_links", "SOCIAL_LINKS", "social_media", "SOCIAL_MEDIA");
  if (nested && typeof nested === "object") {
    const v = pick(nested, "facebook", "FACEBOOK");
    n = normalizeFacebookUrl(v != null ? String(v) : "");
    if (n) return n;
  }

  const emailsSocial = pick(row, "emails_and_social", "EMAILS_AND_SOCIAL");
  if (Array.isArray(emailsSocial)) {
    for (const entry of emailsSocial) {
      if (!entry || typeof entry !== "object") continue;
      const label = String(pick(entry, "type", "label", "name") ?? "").toLowerCase();
      const link = pick(entry, "url", "link", "href");
      if (label.includes("facebook") || /facebook\.com/i.test(String(link ?? ""))) {
        n = normalizeFacebookUrl(link != null ? String(link) : "");
        if (n) return n;
      }
    }
  }

  return null;
}

/** Rating 4+ and reviews in [10, 200] by default. */
export function passesSweetSpotFilters(rating, reviews) {
  const minR = Number(process.env.SWEET_SPOT_MIN_RATING ?? 4);
  const minRev = Number(process.env.SWEET_SPOT_MIN_REVIEWS ?? 10);
  const maxRev = Number(process.env.SWEET_SPOT_MAX_REVIEWS ?? 200);
  const r = toNum(rating);
  const n = toInt(reviews);
  if (r == null || n == null) return false;
  if (r < minR) return false;
  return n >= minRev && n <= maxRev;
}

/**
 * Review list shapes from google_maps_scraper / extractor NDJSON.
 * @param {Record<string, unknown>} row
 * @returns {unknown[]}
 */
export function pickReviewContainers(row) {
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

function envFlagScrape(name, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return def;
}

/**
 * Best-effort ms since epoch for a single review object. Unknown → null (not counted toward a year).
 * @param {unknown} rev
 * @param {number} [nowMs]
 * @returns {number|null}
 */
function relativeAgoToMs(quantity, unitRaw, nowMs) {
  const unit = unitRaw.toLowerCase();
  const n =
    quantity === "a" || quantity === "an" || quantity === "one" ? 1 : Number.parseInt(quantity, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  const sec =
    unit.startsWith("sec")
      ? n
      : unit.startsWith("min")
        ? n * 60
        : unit.startsWith("hour")
          ? n * 3600
          : unit.startsWith("day")
            ? n * 86400
            : unit.startsWith("week")
              ? n * 7 * 86400
              : unit.startsWith("month")
                ? n * 30 * 86400
                : unit.startsWith("year")
                  ? n * 365.25 * 86400
                  : 0;
  return nowMs - sec * 1000;
}

export function parseReviewDateMs(rev, nowMs = Date.now()) {
  if (!rev || typeof rev !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (rev);
  const raw = pick(
    r,
    "review_time",
    "REVIEW_TIME",
    "reviewTime",
    "time",
    "TIME",
    "relative_time",
    "RELATIVE_TIME",
    "relativeTime",
    "relative_description",
    "date",
    "DATE",
    "timestamp",
    "TIMESTAMP",
    "created_at",
    "createdAt",
    "published_at",
    "publishedAt",
    "iso_date",
    "review_date",
  );

  const secTop = toNum(pick(r, "seconds", "SECONDS"));
  if (secTop != null && secTop > 1e9) return secTop * 1000;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 1e12) return raw;
    if (raw > 1e9) return raw * 1000;
    return null;
  }

  if (raw != null && typeof raw === "object") {
    const nested = pick(/** @type {Record<string, unknown>} */ (raw), "seconds", "nanos");
    if (typeof nested === "number" && Number.isFinite(nested) && nested > 1e9) {
      return nested * 1000;
    }
    const alt = pick(/** @type {Record<string, unknown>} */ (raw), "text", "label", "description");
    if (alt != null && typeof alt !== "object") {
      const inner = String(alt).trim();
      const ms = parseReviewDateMs({ ...r, review_time: inner }, nowMs);
      if (ms != null) return ms;
    }
  }

  let s = raw != null ? String(raw).trim() : "";
  if (!s) return null;

  s = s.replace(/^\s*edited\s*:?\s*/i, "").trim();

  let parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return parsed;

  const lower = s.toLowerCase();
  if (/^yesterday\b/i.test(lower)) return relativeAgoToMs("1", "day", nowMs);
  if (/^(last|past)\s+week\b/i.test(lower)) return relativeAgoToMs("1", "week", nowMs);

  let rel = /^(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago\b/i.exec(s);
  if (rel) {
    const ms = relativeAgoToMs(rel[1], rel[2], nowMs);
    return ms != null ? ms : null;
  }

  rel = /^(a|an|one)\s+(second|minute|hour|day|week|month|year)s?\s*ago\b/i.exec(s);
  if (rel) {
    const ms = relativeAgoToMs(rel[1], rel[2], nowMs);
    return ms != null ? ms : null;
  }

  return null;
}

/**
 * Count reviews whose date falls in `calendarYear` (local timezone).
 * @param {Record<string, unknown>} row
 * @param {number} calendarYear e.g. 2026
 * @param {number} [nowMs]
 */
export function countReviewsInCalendarYear(row, calendarYear, nowMs = Date.now()) {
  const reviews = pickReviewContainers(row);
  let n = 0;
  for (const rev of reviews) {
    const ms = parseReviewDateMs(rev, nowMs);
    if (ms == null) continue;
    if (new Date(ms).getFullYear() === calendarYear) n += 1;
  }
  return n;
}

/**
 * Require at least N reviews dated in the filter year (default: current calendar year, min 1).
 * Set SCRAPE_SKIP_MIN_REVIEWS_IN_CALENDAR_YEAR_FILTER=1 to disable.
 * Override year: SCRAPE_REVIEWS_YEAR_FILTER=2026
 * Override min: SCRAPE_MIN_REVIEWS_IN_CALENDAR_YEAR (default 1; use 2+ for stricter gate)
 *
 * @param {Record<string, unknown>} rawRow — full extractor row (with review arrays)
 * @param {{ nowMs?: number }} [opts]
 */
export function passesMinReviewsInCalendarYear(rawRow, opts = {}) {
  if (envFlagScrape("SCRAPE_SKIP_MIN_REVIEWS_IN_CALENDAR_YEAR_FILTER", false)) {
    return true;
  }
  const nowMs = opts.nowMs ?? Date.now();
  const yRaw = process.env.SCRAPE_REVIEWS_YEAR_FILTER;
  const year = yRaw != null && String(yRaw).trim() !== ""
    ? Number.parseInt(String(yRaw), 10)
    : new Date(nowMs).getFullYear();
  if (!Number.isFinite(year)) {
    return false;
  }
  const min = Number.parseInt(
    String(process.env.SCRAPE_MIN_REVIEWS_IN_CALENDAR_YEAR ?? "1"),
    10,
  );
  const need = Number.isFinite(min) && min >= 0 ? min : 1;
  return countReviewsInCalendarYear(rawRow, year, nowMs) >= need;
}

export function getMinReviewsInCalendarYearFilterConfig(nowMs = Date.now()) {
  const disabled = envFlagScrape("SCRAPE_SKIP_MIN_REVIEWS_IN_CALENDAR_YEAR_FILTER", false);
  const yRaw = process.env.SCRAPE_REVIEWS_YEAR_FILTER;
  const year =
    yRaw != null && String(yRaw).trim() !== ""
      ? Number.parseInt(String(yRaw), 10)
      : new Date(nowMs).getFullYear();
  const min = Number.parseInt(
    String(process.env.SCRAPE_MIN_REVIEWS_IN_CALENDAR_YEAR ?? "1"),
    10,
  );
  return {
    disabled,
    year: Number.isFinite(year) ? year : new Date(nowMs).getFullYear(),
    min: Number.isFinite(min) && min >= 0 ? min : 1,
  };
}

export function rowToBusiness(row, businessTypeArg) {
  const da = pickDetailedAddress(row);
  const { latitude, longitude } = pickLatLng(row);
  const website = pick(row, "website", "WEBSITE");
  const websiteTrim = website != null ? String(website).trim() : "";
  const street = da.street ?? pick(row, "address", "ADDRESS");
  return {
    place_id: pick(row, "place_id", "PLACE_ID"),
    name: pick(row, "name", "NAME"),
    address: street ?? null,
    city: da.city,
    state: da.state,
    postal_code: da.postal_code,
    latitude,
    longitude,
    main_category: pick(row, "main_category", "MAIN_CATEGORY"),
    business_type: businessTypeArg,
    rating: toNum(pick(row, "rating", "RATING")),
    reviews: toInt(pick(row, "reviews", "REVIEWS")),
    is_spending_on_ads: Boolean(pick(row, "is_spending_on_ads", "IS_SPENDING_ON_ADS")),
    has_website:
      Boolean(websiteTrim) &&
      !isFacebookWebsiteField(websiteTrim) &&
      !isWhatsAppWebsiteField(websiteTrim),
    phone: pick(row, "phone", "PHONE"),
    google_maps_link: pick(row, "link", "LINK"),
    facebook_url: pickFacebookUrl(row),
    /** Raw Maps website URL (Facebook / WhatsApp / etc.); stored for CRM contact-surface filters. */
    listing_website: websiteTrim ? websiteTrim : null,
  };
}

export function omitUndefined(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) o[k] = v;
  }
  return o;
}

export function normalizeCreatedTasks(created) {
  return Array.isArray(created) ? created : [created];
}

export function extractLeafTaskId(created) {
  const tasks = normalizeCreatedTasks(created);
  const leaf = tasks.find((t) => t && t.is_all_task === false);
  return leaf?.id != null ? Number(leaf.id) : null;
}

function envFlag(name, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return def;
}

function envInt(name, def) {
  const n = Number.parseInt(String(process.env[name] ?? ""), 10);
  return Number.isFinite(n) ? n : def;
}

/**
 * `BOTASAURUS_API_KEY` is passed as `api_key` to google_maps_scraper for email/contact enrichment APIs.
 * When set, `enable_website_contacts` defaults on; override with ENABLE_WEBSITE_CONTACTS=0.
 *
 * @param {string[]} searchLinks
 * @param {number} maxResults
 * @param {{ enableEmailsSocial?: boolean }} [opts]
 */
export function buildGoogleMapsDispatchData(searchLinks, maxResults = 100, opts = {}) {
  const enableEmailsSocial = opts.enableEmailsSocial !== false;
  const apiKey = String(process.env.BOTASAURUS_API_KEY ?? "").trim();
  const enableReviewsExtraction = envFlag("ENABLE_REVIEWS_EXTRACTION", false);
  const maxReviews = Math.max(0, envInt("MAX_REVIEWS_TO_FETCH", 20));
  const maxPhotos = Math.max(0, envInt("MAX_PHOTOS_TO_FETCH", 100));
  const contactsExplicit = process.env.ENABLE_WEBSITE_CONTACTS;
  const enableWebsiteContacts =
    contactsExplicit === "0" || contactsExplicit === "false"
      ? false
      : contactsExplicit === "1" || contactsExplicit === "true"
        ? true
        : Boolean(apiKey);

  return {
    search_method: "links",
    search_links: searchLinks,
    extraction_method: "fast",
    max_results: maxResults,
    enable_reviews_extraction: enableReviewsExtraction,
    geo_shape: "polygons",
    polygons: null,
    point_coordinates: "",
    include_places_outside_city: true,
    exclude_outside_shape: true,
    geo_zoom_level: "16",
    business_types: [],
    countries: [],
    states: [],
    cities: [],
    randomize_cities: true,
    enrichment_filters: [],
    enable_website_contacts: enableWebsiteContacts,
    enable_emails_social: enableEmailsSocial,
    enable_sales_summary: process.env.ENRICH_SALES_SUMMARY === "1",
    enable_phone_info: process.env.ENRICH_PHONE_INFO === "1",
    enable_leads: false,
    enable_photos_extraction: false,
    max_reviews: maxReviews,
    max_photos: maxPhotos,
    lang: null,
    api_key: apiKey,
  };
}

export function mapsSearchLinkForZip(businessType, zipCode) {
  const q = `${businessType} near ${zipCode}`.replace(/\s+/g, " ").trim();
  const encoded = encodeURIComponent(q).replace(/%20/g, "+");
  return `https://www.google.com/maps/search/${encoded}`;
}

/**
 * Maps URL for re-scrape / enrichment. Prefer stored google_maps_link; else search-by-place-id.
 * @param {{ place_id?: string|null; google_maps_link?: string|null }} row
 * @returns {string|null}
 */
export function mapsLinkFromBusinessRow(row) {
  const link = row?.google_maps_link != null ? String(row.google_maps_link).trim() : "";
  if (link) {
    return link;
  }
  const pid = row?.place_id != null ? String(row.place_id).trim() : "";
  if (!pid) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}`;
}

export async function fetchTaskResultsPage(taskId, page) {
  const base = getBotasaurusBase();
  const getUrl = new URL(`${base}/tasks/${taskId}/results`);
  getUrl.searchParams.set("page", String(page));

  let res = await botasaurusFetch(getUrl.toString(), { method: "GET" });
  if (!res.ok) {
    res = await botasaurusFetch(`${base}/tasks/${taskId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page }),
    });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Task results HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchAllTaskResults(taskId) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const json = await fetchTaskResultsPage(taskId, page);
    const chunk = json.results ?? json.data ?? [];
    if (!Array.isArray(chunk)) {
      throw new Error(
        `Unexpected results shape for page ${page}: ${JSON.stringify(json).slice(0, 200)}`,
      );
    }
    all.push(...chunk);
    totalPages = json.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}
