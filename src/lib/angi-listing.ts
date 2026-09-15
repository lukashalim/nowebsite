/**
 * Detect Angi/HomeAdvisor listings via DataForSEO Google organic SERP
 * (no Angi HTML scraping for discovery). Paid/Approved confirmation uses
 * Playwright profile scrape when SERP finds a business profile URL.
 */

import {
  closeAngiProfileBrowser,
  extractAddressFromAngiPageText,
  isAngiBusinessProfileUrl,
  isAngiCategoryOrArticleUrl,
  leadStreetLineOnly,
  scrapeAngiProfilePage,
} from "./angi-profile-scrape";
import { resolveAngiOwnerNameFromAboutUs } from "./angi-owner-name";

export const ANGI_DOMAINS = ["angi.com", "homeadvisor.com"] as const;

export const ANGI_MATCH_YES_THRESHOLD = 0.65;
export const ANGI_MATCH_MAYBE_THRESHOLD = 0.55;
export const ANGI_MAX_COMPETITORS = 3;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AngiCompetitor {
  name: string;
  url?: string | null;
  title?: string | null;
}

export interface AngiListingInput {
  name: string | null | undefined;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  country?: "US" | "GB" | "AU" | null;
  mainCategory?: string | null;
  businessType?: string | null;
  directoryCategorySlug?: string | null;
}

export interface AngiSerpItem {
  type?: string;
  domain?: string | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  snippet?: string | null;
}

export interface AngiListingMatch {
  hasListing: boolean;
  url: string | null;
  title: string | null;
  confidence: number;
  keyword: string;
}

export interface AngiListingResult extends AngiListingMatch {
  competitors: AngiCompetitor[];
  competitorKeyword: string | null;
  checkedAt: string;
  /** How hasListing was decided. */
  verification?: "angi_approved_scrape" | "serp_profile_proxy" | "none";
  scrapeSignals?: string[];
  /** Owner first name from Angi "About us" when found. */
  angiOwnerName?: string | null;
}

export interface DataForSeoCredentials {
  login: string;
  password: string;
}

const LEGAL_SUFFIX_RE =
  /\b(llc|l\.l\.c\.?|inc\.?|incorporated|corp\.?|corporation|co\.|company|ltd\.?|limited|pllc|p\.l\.l\.c\.?|llp)\b/gi;

const ANGI_TITLE_NOISE_RE =
  /\s*[-–—|]\s*(angi|homeadvisor|home advisor).*$/i;

/**
 * Dashboard shows both a raw API password and a Base64 `login:password` blob.
 * If `password` looks like that blob, unwrap so Basic auth works.
 */
export function unwrapDataForSeoPasswordIfBase64(
  login: string,
  password: string,
): DataForSeoCredentials {
  const trimmed = password.trim();
  if (!/^[A-Za-z0-9+/]+=*$/.test(trimmed) || trimmed.length < 20) {
    return { login, password: trimmed };
  }
  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    return { login, password: trimmed };
  }
  if (/[\u0000-\u0008\u000e-\u001f]/.test(decoded)) {
    return { login, password: trimmed };
  }
  const colon = decoded.indexOf(":");
  if (colon <= 0) return { login, password: trimmed };
  const decodedLogin = decoded.slice(0, colon).trim();
  const decodedPassword = decoded.slice(colon + 1);
  if (!decodedLogin || !decodedPassword) {
    return { login, password: trimmed };
  }
  if (
    decodedLogin === login ||
    decodedLogin.toLowerCase() === login.toLowerCase()
  ) {
    return { login: decodedLogin, password: decodedPassword };
  }
  return { login, password: trimmed };
}

export function resolveDataForSeoCredentials(
  env: NodeJS.ProcessEnv = process.env,
): DataForSeoCredentials | null {
  const base64Only =
    env.DATAFORSEO_BASE64?.trim() ||
    env.DATAFORSEO_AUTH_BASE64?.trim() ||
    env.dataforseo_base64?.trim() ||
    "";
  if (base64Only) {
    try {
      const decoded = Buffer.from(base64Only, "base64").toString("utf8");
      const colon = decoded.indexOf(":");
      if (colon > 0) {
        const login = decoded.slice(0, colon).trim();
        const password = decoded.slice(colon + 1);
        if (login && password) return { login, password };
      }
    } catch {
      /* ignore */
    }
  }

  const login =
    env.DATAFORSEO_LOGIN?.trim() ||
    env.DATAFORSEO_USERNAME?.trim() ||
    env.dataforseo_login?.trim() ||
    env.dataforseo_username?.trim() ||
    "";
  const password =
    env.DATAFORSEO_PASSWORD?.trim() ||
    env.dataforseo_password?.trim() ||
    "";
  if (!login || !password) return null;
  return unwrapDataForSeoPasswordIfBase64(login, password);
}

export function normalizeBusinessNameForMatch(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  return raw
    .toLowerCase()
    .replace(LEGAL_SUFFIX_RE, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeName(normalized: string): string[] {
  return normalized
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

export function similarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

export function tokenOverlapScore(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const bSet = new Set(bTokens);
  let hit = 0;
  for (const t of aTokens) {
    if (bSet.has(t)) hit += 1;
  }
  return hit / Math.max(aTokens.length, bTokens.length);
}

export function isAngiDomain(domain: string | null | undefined): boolean {
  if (!domain?.trim()) return false;
  const d = domain.trim().toLowerCase().replace(/^www\./, "");
  return ANGI_DOMAINS.some(
    (root) => d === root || d.endsWith(`.${root}`),
  );
}

export function phoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/** True when we have enough fields for an Angi SERP listing query. */
export function canBuildAngiListingKeyword(input: AngiListingInput): boolean {
  return Boolean(input.name?.trim() && (input.city?.trim() || input.state?.trim()));
}

/** Format phone for optional SERP snippet matching (US display form). */
export function formatPhoneForAngiSearch(
  phone: string | null | undefined,
  country: "US" | "GB" | "AU" | null | undefined = "US",
): string | null {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return null;
  if ((country ?? "US") === "US" && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

/** @deprecated Phone is no longer required for Angi SERP; kept for callers. */
export function hasValidPhoneForAngiListing(
  phone: string | null | undefined,
): boolean {
  return phoneDigits(phone).length >= 10;
}

function serpHaystack(item: AngiSerpItem): string {
  return `${item.title ?? ""} ${item.description ?? ""} ${item.snippet ?? ""} ${item.url ?? ""}`;
}

export function phoneAppearsInSerpHaystack(
  phone: string | null | undefined,
  haystack: string,
): boolean {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return false;
  const snippetDigits = haystack.replace(/\D/g, "");
  return (
    snippetDigits.includes(digits) ||
    snippetDigits.includes(digits.slice(-10))
  );
}

export function categoryLabelForAngiQuery(input: AngiListingInput): string {
  const main = input.mainCategory?.trim();
  if (main) return main.toLowerCase();
  const type = input.businessType?.trim();
  if (type) return type.toLowerCase();
  const slug = input.directoryCategorySlug?.trim();
  if (slug) return slug.replace(/-/g, " ");
  return "home services";
}

/** SERP query: `{business name} {city} {state} angi` (no phone). */
export function buildAngiListingKeyword(
  input: AngiListingInput,
  _country: "US" | "GB" | "AU" | null | undefined = "US",
): string | null {
  const name = input.name?.trim();
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  if (!name || (!city && !state)) return null;
  return [name, city, state, "angi"].filter(Boolean).join(" ").trim();
}

/** SERP query with street address when available (often surfaces address in snippet). */
export function buildAngiListingKeywordWithAddress(
  input: AngiListingInput,
  _country: "US" | "GB" | "AU" | null | undefined = "US",
): string | null {
  const name = input.name?.trim();
  const street = leadStreetLineOnly(input.address);
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  if (!name || !street || (!city && !state)) return null;
  return [name, street, city, state, "angi"].filter(Boolean).join(" ").trim();
}

export function buildAngiCompetitorKeyword(input: AngiListingInput): string {
  const category = categoryLabelForAngiQuery(input);
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  return ["angi", category, city, state].filter(Boolean).join(" ").trim();
}

export function dataForSeoLocationName(input: AngiListingInput): string {
  const city = input.city?.trim();
  const state = input.state?.trim();
  if (city && state) return `${city},${state},United States`;
  if (state) return `${state},United States`;
  return "United States";
}

/** Extract a company-ish name from an Angi SERP title. */
export function companyNameFromAngiTitle(title: string | null | undefined): string {
  if (!title?.trim()) return "";
  let s = title.trim().replace(ANGI_TITLE_NOISE_RE, "").trim();
  s = s.replace(/\s*\(\d+(\.\d+)?\)\s*$/, "").trim();
  s = s.replace(/\s[-–—]\s*[A-Za-z .]+,\s*[A-Z]{2}\s*$/, "").trim();
  return s.replace(/\s+/g, " ").trim();
}

const US_STATE_TO_ABBR: Record<string, string> = {
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

const GENERIC_BUSINESS_TOKENS = new Set([
  "and",
  "the",
  "inc",
  "llc",
  "co",
  "company",
  "services",
  "service",
  "repair",
  "repairs",
  "plumbing",
  "hvac",
  "heating",
  "air",
  "conditioning",
  "mechanical",
  "electric",
  "electrical",
  "appliance",
  "tree",
  "trimming",
  "landscaping",
  "septic",
  "tank",
  "drain",
  "clearing",
  "home",
  "pro",
  "pros",
]);

/** Parse `/companylist/us/va/yorktown/...` city + state from an Angi profile URL. */
export function parseAngiProfileLocationFromUrl(
  url: string | null | undefined,
): { city: string; stateAbbr: string } | null {
  if (!url?.trim()) return null;
  const match = url.match(/\/companylist\/us\/([a-z]{2})\/([^/]+)\//i);
  if (!match?.[1] || !match[2]) return null;
  return {
    stateAbbr: match[1].toLowerCase(),
    city: match[2].toLowerCase().replace(/-/g, " ").trim(),
  };
}

function normalizeStateToAbbr(state: string | null | undefined): string | null {
  const raw = state?.trim().toLowerCase();
  if (!raw) return null;
  if (/^[a-z]{2}$/.test(raw)) return raw;
  return US_STATE_TO_ABBR[raw] ?? null;
}

function normalizeCitySlug(city: string | null | undefined): string {
  return (city ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Angi profile URL city/state must match the lead location. */
export function profileLocationMatchesInput(
  input: AngiListingInput,
  profileUrl: string | null | undefined,
): boolean {
  const parsed = parseAngiProfileLocationFromUrl(profileUrl);
  if (!parsed) return true;

  const inputState = normalizeStateToAbbr(input.state);
  if (inputState && parsed.stateAbbr !== inputState) return false;

  const inputCity = normalizeCitySlug(input.city);
  if (inputCity.length > 2) {
    const profileCity = parsed.city;
    if (
      profileCity !== inputCity &&
      !profileCity.includes(inputCity) &&
      !inputCity.includes(profileCity)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Require a distinctive token from the lead name in the profile title/URL.
 * Blocks false positives like Briggs Appliance → G-H Appliance Repair.
 */
export function profileNameMatchesBusiness(
  businessName: string,
  profileUrl: string | null | undefined,
  profileTitle: string | null | undefined,
): boolean {
  const bizTokens = tokenizeName(normalizeBusinessNameForMatch(businessName));
  if (bizTokens.length === 0) return false;

  const haystack = `${profileTitle ?? ""} ${profileUrl ?? ""}`.toLowerCase();
  const distinctive = bizTokens.filter(
    (t) => t.length >= 4 && !GENERIC_BUSINESS_TOKENS.has(t),
  );
  const tokensToCheck =
    distinctive.length > 0
      ? distinctive
      : bizTokens.filter((t) => t.length >= 3);

  return tokensToCheck.some((t) => haystack.includes(t));
}

const STREET_ABBREV: Record<string, string> = {
  street: "st",
  st: "st",
  avenue: "ave",
  ave: "ave",
  road: "rd",
  rd: "rd",
  drive: "dr",
  dr: "dr",
  lane: "ln",
  ln: "ln",
  boulevard: "blvd",
  blvd: "blvd",
  circle: "cir",
  cir: "cir",
  court: "ct",
  ct: "ct",
  east: "e",
  e: "e",
  west: "w",
  w: "w",
  north: "n",
  n: "n",
  south: "s",
  s: "s",
};

/** Normalize a street line for comparison (6760 28th St Cir E → 6760 28th cir e). */
export function normalizeStreetAddress(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  return raw
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/,/g, " ")
    .split(/\s+/)
    .map((token) => STREET_ABBREV[token] ?? token)
    .join(" ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function streetNumber(raw: string): string | null {
  const match = raw.match(/\b(\d+[a-z]?)\b/);
  return match?.[1] ?? null;
}

function streetTokens(raw: string): string[] {
  return raw
    .split(" ")
    .filter((t) => t.length > 0 && !/^\d+[a-z]?$/.test(t));
}

/**
 * True when lead address and Angi profile address refer to the same street.
 * Abbreviations are normalized (St/Street, Cir/Circle, E/East, etc.).
 * Requires matching street number plus overlapping street tokens.
 */
export function addressesMatch(
  leadAddress: string | null | undefined,
  profileAddress: string | null | undefined,
): boolean {
  const a = normalizeStreetAddress(leadStreetLineOnly(leadAddress) ?? leadAddress);
  const b = normalizeStreetAddress(profileAddress);
  if (!a || !b) return false;

  const numA = streetNumber(a);
  const numB = streetNumber(b);
  if (!numA || !numB || numA !== numB) return false;

  const tokensA = streetTokens(a);
  const tokensB = new Set(streetTokens(b));
  if (tokensA.length === 0 || tokensB.size === 0) return false;

  const hits = tokensA.filter((t) => tokensB.has(t)).length;
  return hits >= Math.min(2, tokensA.length);
}

function profileAddressMatchesLead(
  leadAddress: string | null | undefined,
  ...candidateTexts: Array<string | null | undefined>
): boolean {
  if (!leadAddress?.trim()) return false;
  for (const text of candidateTexts) {
    if (!text?.trim()) continue;
    const extracted = extractAddressFromAngiPageText(text) ?? text.trim();
    if (addressesMatch(leadAddress, extracted)) return true;
  }
  return false;
}

export function verifyAngiProfileMatch(
  input: AngiListingInput,
  profileUrl: string | null | undefined,
  profileTitle: string | null | undefined,
  opts?: {
    addressOnPage?: string | null;
    serpHaystack?: string | null;
  },
): boolean {
  if (!profileLocationMatchesInput(input, profileUrl)) return false;

  if (
    profileAddressMatchesLead(
      input.address,
      opts?.addressOnPage,
      opts?.serpHaystack,
    )
  ) {
    return true;
  }

  return profileNameMatchesBusiness(
    input.name?.trim() ?? "",
    profileUrl,
    profileTitle,
  );
}

export function scoreAngiCandidate(
  businessName: string,
  item: AngiSerpItem,
  opts: { city?: string | null; state?: string | null; phone?: string | null },
): number {
  const bizNorm = normalizeBusinessNameForMatch(businessName);
  if (!bizNorm) return 0;

  const titleName = companyNameFromAngiTitle(item.title);
  const titleNorm = normalizeBusinessNameForMatch(titleName || item.title);
  const urlPath = (item.url ?? "").toLowerCase();
  const haystack = `${item.title ?? ""} ${item.description ?? ""} ${item.snippet ?? ""} ${urlPath}`;

  let score = Math.max(
    tokenOverlapScore(tokenizeName(bizNorm), tokenizeName(titleNorm)),
    similarityRatio(bizNorm, titleNorm),
  );

  const bizTokens = tokenizeName(bizNorm);
  if (bizTokens.length > 0) {
    const urlHits = bizTokens.filter((t) => urlPath.includes(t)).length;
    score = Math.max(score, urlHits / bizTokens.length);
  }

  const city = opts.city?.trim().toLowerCase();
  const state = opts.state?.trim().toLowerCase();
  const locHay = haystack.toLowerCase();
  if (city && city.length > 2 && locHay.includes(city)) {
    score = Math.min(1, score + 0.08);
  }
  if (state && state.length >= 2 && locHay.includes(state)) {
    score = Math.min(1, score + 0.04);
  }

  const digits = phoneDigits(opts.phone);
  if (digits.length >= 10) {
    const snippetDigits = haystack.replace(/\D/g, "");
    if (snippetDigits.includes(digits) || snippetDigits.includes(digits.slice(-10))) {
      score = Math.max(score, 0.92);
    }
  }

  // Prefer real business profiles over category/article pages.
  if (isAngiBusinessProfileUrl(item.url)) {
    score = Math.min(1, score + 0.12);
  } else if (isAngiCategoryOrArticleUrl(item.url)) {
    score = Math.max(0, score - 0.25);
  }

  // SERP often shows "Angi Approved" in title for paid pros.
  if (/angi\s*approved|\bapproved\b/i.test(`${item.title ?? ""} ${item.description ?? ""}`)) {
    score = Math.min(1, score + 0.1);
  }

  return Math.max(0, Math.min(1, score));
}

export function pickBestAngiListingMatch(
  input: AngiListingInput,
  items: AngiSerpItem[],
  opts?: { country?: "US" | "GB" | "AU" | null },
): AngiListingMatch {
  const keyword =
    buildAngiListingKeyword(input, opts?.country ?? "US") ?? "";
  const name = input.name?.trim() ?? "";
  const angiItems = items.filter((i) => isAngiDomain(i.domain));

  let best: {
    item: AngiSerpItem;
    score: number;
    isProfile: boolean;
  } | null = null;

  for (const item of angiItems) {
    const score = scoreAngiCandidate(name, item, {
      city: input.city,
      state: input.state,
      phone: input.phone,
    });
    const isProfile = isAngiBusinessProfileUrl(item.url);
    if (
      !best ||
      score > best.score ||
      (score === best.score && isProfile && !best.isProfile)
    ) {
      best = { item, score, isProfile };
    }
  }

  if (!best || best.score < ANGI_MATCH_MAYBE_THRESHOLD) {
    return {
      hasListing: false,
      url: best?.item.url?.trim() || null,
      title: best?.item.title?.trim() || null,
      confidence: best?.score ?? 0,
      keyword,
    };
  }

  // Candidate only: final paid decision is made after Playwright profile scrape
  // (or SERP profile-URL proxy if scrape is blocked).
  const hasListing =
    best.isProfile && best.score >= ANGI_MATCH_YES_THRESHOLD;
  return {
    hasListing,
    url: best.item.url?.trim() || null,
    title: best.item.title?.trim() || null,
    confidence: best.score,
    keyword,
  };
}

export function extractAngiCompetitors(
  input: AngiListingInput,
  items: AngiSerpItem[],
  excludeName?: string | null,
): AngiCompetitor[] {
  const excludeNorm = normalizeBusinessNameForMatch(excludeName ?? input.name);
  const seen = new Set<string>();
  const out: AngiCompetitor[] = [];

  for (const item of items) {
    if (!isAngiDomain(item.domain)) continue;
    const name = companyNameFromAngiTitle(item.title);
    if (!name || name.length < 2) continue;
    const norm = normalizeBusinessNameForMatch(name);
    if (!norm || seen.has(norm)) continue;
    if (
      excludeNorm &&
      (norm === excludeNorm ||
        similarityRatio(norm, excludeNorm) >= 0.85 ||
        tokenOverlapScore(tokenizeName(norm), tokenizeName(excludeNorm)) >= 0.85)
    ) {
      continue;
    }
    seen.add(norm);
    out.push({
      name,
      url: item.url?.trim() || null,
      title: item.title?.trim() || null,
    });
    if (out.length >= ANGI_MAX_COMPETITORS) break;
  }

  return out;
}

export function flattenDataForSeoSerpItems(payload: unknown): AngiSerpItem[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as {
    tasks?: Array<{
      result?: Array<{
        items?: AngiSerpItem[];
      }>;
    }>;
  };
  const items: AngiSerpItem[] = [];
  for (const task of root.tasks ?? []) {
    for (const result of task.result ?? []) {
      for (const item of result.items ?? []) {
        if (!item || typeof item !== "object") continue;
        const type = item.type?.toLowerCase() ?? "";
        if (
          type === "organic" ||
          type === "local_pack" ||
          type === "knowledge_graph" ||
          type === "featured_snippet" ||
          !type
        ) {
          items.push(item);
        }
        // Nested local_pack items sometimes appear under `items`
        const nested = (item as { items?: AngiSerpItem[] }).items;
        if (Array.isArray(nested)) {
          for (const child of nested) {
            if (child && typeof child === "object") items.push(child);
          }
        }
      }
    }
  }
  return items;
}

export async function fetchDataForSeoOrganicLive(
  keyword: string,
  credentials: DataForSeoCredentials,
  opts?: { locationName?: string; depth?: number },
): Promise<{ ok: true; items: AngiSerpItem[]; raw: unknown } | { ok: false; error: string; httpStatus?: number }> {
  const locationName = opts?.locationName?.trim() || "United States";
  const depth = opts?.depth ?? 10;

  const body = [
    {
      keyword,
      location_name: locationName,
      language_code: "en",
      device: "desktop",
      depth,
    },
  ];

  let res: Response;
  try {
    res = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${credentials.login}:${credentials.password}`).toString(
              "base64",
            ),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      error: `Invalid JSON from DataForSEO (HTTP ${res.status})`,
      httpStatus: res.status,
    };
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" &&
      json &&
      "status_message" in json &&
      typeof (json as { status_message?: unknown }).status_message === "string"
        ? (json as { status_message: string }).status_message
        : `HTTP ${res.status}`;
    return { ok: false, error: msg, httpStatus: res.status };
  }

  const statusCode =
    typeof json === "object" &&
    json &&
    "status_code" in json &&
    typeof (json as { status_code?: unknown }).status_code === "number"
      ? (json as { status_code: number }).status_code
      : null;

  if (statusCode != null && statusCode !== 20000) {
    const msg =
      typeof json === "object" &&
      json &&
      "status_message" in json &&
      typeof (json as { status_message?: unknown }).status_message === "string"
        ? (json as { status_message: string }).status_message
        : `DataForSEO status ${statusCode}`;
    return { ok: false, error: msg, httpStatus: res.status };
  }

  return {
    ok: true,
    items: flattenDataForSeoSerpItems(json),
    raw: json,
  };
}

export function formatAngiCompetitorsList(
  competitors: AngiCompetitor[] | null | undefined,
): string {
  const names = (competitors ?? [])
    .map((c) => c.name?.trim())
    .filter(Boolean) as string[];
  if (names.length === 0) return "your competitors";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function parseAngiCompetitorsJson(raw: unknown): AngiCompetitor[] {
  if (!Array.isArray(raw)) return [];
  const out: AngiCompetitor[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const name = (row as { name?: unknown }).name;
    if (typeof name !== "string" || !name.trim()) continue;
    out.push({
      name: name.trim(),
      url:
        typeof (row as { url?: unknown }).url === "string"
          ? (row as { url: string }).url
          : null,
      title:
        typeof (row as { title?: unknown }).title === "string"
          ? (row as { title: string }).title
          : null,
    });
  }
  return out;
}

/**
 * Full listing + competitor detection for one business.
 * 1) SERP finds Angi business profile URL
 * 2) Playwright scrapes profile for "Angi Approved" (paid)
 * 3) If scrape blocked, fall back to SERP profile-URL proxy
 */
export async function detectAngiListingForBusiness(
  input: AngiListingInput,
  credentials: DataForSeoCredentials,
  opts?: { keepBrowserOpen?: boolean },
): Promise<
  | { ok: true; result: AngiListingResult }
  | { ok: false; error: string; httpStatus?: number }
> {
  const checkedAt = new Date().toISOString();
  const country = input.country ?? "US";
  const listingKeyword = buildAngiListingKeyword(input, country);

  try {
  if (!listingKeyword) {
    return {
      ok: true,
      result: {
        hasListing: false,
        url: null,
        title: null,
        confidence: 0,
        keyword: "",
        competitors: [],
        competitorKeyword: null,
        checkedAt,
        verification: "none",
        scrapeSignals: [],
      },
    };
  }

  const locationName = dataForSeoLocationName(input);

  let listingSerp = await fetchDataForSeoOrganicLive(
    listingKeyword,
    credentials,
    { locationName },
  );
  if (!listingSerp.ok) {
    return listingSerp;
  }

  let match = pickBestAngiListingMatch(input, listingSerp.items, { country });

  let profileUrl =
    match.url && isAngiBusinessProfileUrl(match.url) ? match.url : null;

  // DataForSEO SERP can flake on batch runs — retry once when no usable profile.
  if (
    (!profileUrl || match.confidence < ANGI_MATCH_MAYBE_THRESHOLD) &&
    listingSerp.ok
  ) {
    await sleepMs(600);
    const retrySerp = await fetchDataForSeoOrganicLive(
      listingKeyword,
      credentials,
      { locationName },
    );
    if (retrySerp.ok) {
      const retryMatch = pickBestAngiListingMatch(input, retrySerp.items, {
        country,
      });
      const retryProfile =
        retryMatch.url && isAngiBusinessProfileUrl(retryMatch.url)
          ? retryMatch.url
          : null;
      if (
        retryMatch.confidence > match.confidence ||
        (retryProfile && !profileUrl)
      ) {
        listingSerp = retrySerp;
        match = retryMatch;
        profileUrl = retryProfile;
      }
    }
  }

  const matchedSerpItem = listingSerp.items.find(
    (item) => item.url?.trim() === match.url?.trim(),
  );
  let serpHaystack = [
    match.title,
    matchedSerpItem?.description,
    matchedSerpItem?.snippet,
    (matchedSerpItem as { pre_snippet?: string | null })?.pre_snippet,
    (matchedSerpItem as { extended_snippet?: string | null })?.extended_snippet,
    match.url,
  ]
    .filter(Boolean)
    .join(" ");

  // DataForSEO organic snippets often omit the address; try address-in-query SERP too.
  const addressKeyword = buildAngiListingKeywordWithAddress(input, country);
  if (addressKeyword && input.address?.trim()) {
    const addressSerp = await fetchDataForSeoOrganicLive(
      addressKeyword,
      credentials,
      { locationName, depth: 10 },
    );
    if (addressSerp.ok) {
      const addressItems = addressSerp.items.filter((item) =>
        isAngiDomain(item.domain),
      );
      serpHaystack = [
        serpHaystack,
        ...addressItems.flatMap((item) => [
          item.title,
          item.description,
          item.snippet,
          item.url,
        ]),
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  let hasListing = false;
  let verification: AngiListingResult["verification"] = "none";
  let scrapeSignals: string[] = [];
  let angiOwnerName: string | null = null;

  const preScrapeIdentityOk = (await import("./angi-profile-identity")).shouldScrapeAngiProfile(
    input,
    profileUrl,
    match.title,
    serpHaystack,
  );

  if (
    profileUrl &&
    match.confidence >= ANGI_MATCH_MAYBE_THRESHOLD &&
    preScrapeIdentityOk
  ) {
    const scrape = await scrapeAngiProfilePage(profileUrl, {
      businessName: input.name,
    });

    let scrapeResult = scrape;
    if (!scrape.ok && !scrape.blocked) {
      await sleepMs(800);
      scrapeResult = await scrapeAngiProfilePage(profileUrl, {
        businessName: input.name,
      });
      if (scrapeResult.ok) {
        scrapeSignals.push("scrape_retry_ok");
      } else if (!scrapeResult.error && scrape.error) {
        scrapeResult = { ...scrapeResult, error: scrape.error };
      }
    }

    const { resolveAngiProfileIdentity } = await import("./angi-profile-identity");
    const identity = await resolveAngiProfileIdentity(
      input,
      profileUrl,
      match.title,
      {
        addressOnPage: scrapeResult.addressOnPage,
        serpHaystack,
        aboutUsText: scrapeResult.aboutUsText,
      },
    );
    const identityOk = identity.isMatch;

    if (scrapeResult.ok && identityOk && scrapeResult.aboutUsText) {
      angiOwnerName = await resolveAngiOwnerNameFromAboutUs(
        scrapeResult.aboutUsText,
        input.name,
      );
    }

    if (scrapeResult.ok && identityOk) {
      hasListing = scrapeResult.isApproved;
      verification = "angi_approved_scrape";
      scrapeSignals = [...scrapeResult.signals, ...identity.signals];
      if (profileAddressMatchesLead(input.address, scrapeResult.addressOnPage, serpHaystack)) {
        scrapeSignals.push("address_match");
      }
      if (angiOwnerName) {
        scrapeSignals.push("owner_name_extracted");
      }
    } else if (scrapeResult.ok && !identityOk) {
      angiOwnerName = null;
      scrapeSignals = ["profile_identity_mismatch", ...identity.signals];
    } else if (scrapeResult.blocked) {
      const serpSaysApproved = /angi\s*approved/i.test(
        `${match.title ?? ""} ${match.url ?? ""}`,
      );
      if (serpSaysApproved && preScrapeIdentityOk) {
        const proxyIdentity = await resolveAngiProfileIdentity(
          input,
          profileUrl,
          match.title,
          { serpHaystack },
        );
        if (proxyIdentity.isMatch) {
          hasListing = true;
          verification = "serp_profile_proxy";
          scrapeSignals = [
            "serp_angi_approved",
            ...proxyIdentity.signals,
            ...scrapeResult.signals,
          ];
        } else {
          scrapeSignals = [
            "cloudflare_blocked",
            "profile_identity_mismatch",
            ...proxyIdentity.signals,
            ...(scrapeResult.error ? [`scrape_error:${scrapeResult.error}`] : []),
          ];
        }
      } else {
        scrapeSignals = [
          "cloudflare_blocked",
          ...(scrapeResult.error ? [`scrape_error:${scrapeResult.error}`] : []),
        ];
      }
    } else {
      scrapeSignals = [
        scrapeResult.error
          ? `scrape_error:${scrapeResult.error}`
          : "scrape_failed",
      ];
    }
  } else if (profileUrl && match.confidence < ANGI_MATCH_MAYBE_THRESHOLD) {
    scrapeSignals = ["below_serp_confidence"];
  } else if (profileUrl && !preScrapeIdentityOk) {
    scrapeSignals = ["profile_identity_mismatch"];
  } else if (!profileUrl && match.url) {
    scrapeSignals = ["serp_category_only"];
  } else if (!profileUrl) {
    scrapeSignals = ["serp_no_profile_match"];
  }

  let competitors: AngiCompetitor[] = [];
  let competitorKeyword: string | null = null;

  if (hasListing) {
    competitorKeyword = buildAngiCompetitorKeyword(input);
    const competitorSerp = await fetchDataForSeoOrganicLive(
      competitorKeyword,
      credentials,
      { locationName },
    );
    if (competitorSerp.ok) {
      competitors = extractAngiCompetitors(
        input,
        competitorSerp.items,
        match.title ? companyNameFromAngiTitle(match.title) : input.name,
      );
    }
  }

  return {
    ok: true,
    result: {
      ...match,
      hasListing,
      competitors,
      competitorKeyword,
      checkedAt,
      verification,
      scrapeSignals,
      angiOwnerName,
    },
  };
  } finally {
    if (!opts?.keepBrowserOpen) {
      await closeAngiProfileBrowser();
    }
  }
}
