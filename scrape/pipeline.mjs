import {
  loadEnvLocal,
  getSupabase,
  fetchAllTaskResults,
  rowToBusiness,
  omitUndefined,
  pick,
  toNum,
  sleep,
  passesSweetSpotFilters,
  mapsSearchLinkForZip,
} from "./lib/scrape-pipeline/index.mjs";
import { attachDemoSlugsToPayloads } from "./lib/demo-slug.mjs";
import { resolveBusinessTypeFromMapsSearch } from "./lib/maps-search-category.mjs";
import {
  applyLocationFallbacks,
  enrichLocationAsync,
} from "./lib/location-fallbacks.mjs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const BUSINESSES_UPSERT_BATCH_SIZE = Math.max(
  25,
  Number.parseInt(process.env.BUSINESSES_UPSERT_BATCH_SIZE ?? "100", 10) || 100,
);
const BUSINESSES_TABLE = process.env.BUSINESSES_TABLE ?? "businesses";
const SCRAPE_JOBS_TABLE = process.env.SCRAPE_JOBS_TABLE ?? "scrape_jobs";

function envFlag(name, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return def;
}

const ENABLE_CATEGORY_VALIDATION = envFlag("ENABLE_CATEGORY_VALIDATION", true);
const ENABLE_WEAKNESS_SUMMARY = envFlag("ENABLE_WEAKNESS_SUMMARY", true);

function getOpenRouterModel() {
  return (
    process.env.OPENROUTER_MODEL ?? "google/gemini-flash-1.5-8b"
  );
}

/** Model for category validation (override: OPENROUTER_VALIDATION_MODEL). */
function getOpenRouterValidationModel() {
  return (
    process.env.OPENROUTER_VALIDATION_MODEL ??
    "google/gemini-2.0-flash-lite-001"
  );
}

/** Model for negative-review summarization (override: OPENROUTER_SUMMARIZE_MODEL). */
function getOpenRouterSummarizeModel() {
  return (
    process.env.OPENROUTER_SUMMARIZE_MODEL ??
    "google/gemini-2.0-flash-lite-001"
  );
}

/** Min ms between OpenRouter calls (free tier is often ~8–16/min). */
function getOpenRouterMinIntervalMs() {
  const n = Number(process.env.OPENROUTER_MIN_INTERVAL_MS);
  return Number.isFinite(n) && n >= 0 ? n : 5000;
}

function getOpenRouterMax429Retries() {
  const n = Number(process.env.OPENROUTER_MAX_RETRIES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 8;
}

function getOpenRouter429MaxWaitMs() {
  const n = Number(process.env.OPENROUTER_429_MAX_WAIT_MS);
  return Number.isFinite(n) && n >= 1000 ? n : 120_000;
}

let openRouterLastCallEnd = 0;

async function paceOpenRouter() {
  const minMs = getOpenRouterMinIntervalMs();
  const gap = Date.now() - openRouterLastCallEnd;
  if (gap < minMs) {
    await sleep(minMs - gap);
  }
}

function bumpOpenRouterClock() {
  openRouterLastCallEnd = Date.now();
}

/** Wait until reset (from JSON body or Retry-After), capped. */
function parseOpenRouter429WaitMs(bodyText, headers) {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const s = parseInt(retryAfter, 10);
    if (Number.isFinite(s)) {
      return Math.min(Math.max(s * 1000, 2000), getOpenRouter429MaxWaitMs());
    }
  }
  try {
    const j = JSON.parse(bodyText);
    const reset = j?.error?.metadata?.headers?.["X-RateLimit-Reset"];
    if (reset != null) {
      const t =
        typeof reset === "string" ? parseInt(reset, 10) : Number(reset);
      if (Number.isFinite(t)) {
        const wait = t - Date.now() + 750;
        return Math.min(
          Math.max(wait, 2000),
          getOpenRouter429MaxWaitMs(),
        );
      }
    }
  } catch {
    /* ignore */
  }
  return Math.min(60_000, getOpenRouter429MaxWaitMs());
}

async function openRouterCompletion(userContent, maxTokens = 200) {
  return openRouterChat(
    [{ role: "user", content: userContent }],
    maxTokens,
    { temperature: 0.2, model: getOpenRouterSummarizeModel() },
  );
}

const VALIDATION_SYSTEM = `You are a classifier API. You must answer with ONLY valid JSON — one object, no keys other than "in_category", no markdown fences, no explanation, no preamble.

Allowed outputs (pick one, nothing else):
{"in_category":true}
{"in_category":false}`;

/**
 * @param {{ role: string; content: string }[]} messages
 * @param {object} [opts]
 * @param {number} [opts.temperature]
 * @param {boolean} [opts.jsonObjectMode] - OpenRouter/OpenAI-style json_object (if model supports it)
 * @param {string} [opts.model] - OpenRouter model id (default: OPENROUTER_MODEL / flash 1.5 8b)
 */
async function openRouterChat(messages, maxTokens = 200, opts = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY missing in .env.local");
  }
  const payload = {
    model: opts.model ?? getOpenRouterModel(),
    messages,
    max_tokens: maxTokens,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.jsonObjectMode) {
    payload.response_format = { type: "json_object" };
  }

  const max429 = getOpenRouterMax429Retries();
  let lastErrText = "";

  for (let attempt = 0; attempt < max429; attempt++) {
    await paceOpenRouter();
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "https://localhost",
        "X-Title": "nowebsite-gmb-facebook-pipeline",
      },
      body: JSON.stringify(payload),
    });
    const rawText = await res.text();
    bumpOpenRouterClock();

    if (res.status === 429) {
      lastErrText = rawText;
      const waitMs = parseOpenRouter429WaitMs(rawText, res.headers);
      console.error(
        `OpenRouter 429 (${attempt + 1}/${max429}); sleeping ${Math.round(waitMs / 1000)}s…`,
      );
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      throw new Error(`OpenRouter HTTP ${res.status}: ${rawText}`);
    }

    let json;
    try {
      json = JSON.parse(rawText);
    } catch {
      throw new Error(`OpenRouter: invalid JSON body: ${rawText.slice(0, 200)}`);
    }
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  throw new Error(
    `OpenRouter HTTP 429 after ${max429} retries: ${lastErrText.slice(0, 400)}`,
  );
}

function parseInCategoryJson(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) {
    s = objMatch[0];
  }
  try {
    const j = JSON.parse(s);
    if (typeof j.in_category === "boolean") {
      return j.in_category;
    }
    if (typeof j.match === "boolean") {
      return j.match;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Lowercase + collapse whitespace for substring category checks. */
function normalizeCategoryMatchString(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True if `expectedCategory` appears as a substring of `text` (e.g. "lawn care" in "Lawn care service").
 * Skips when the expected phrase is too short to avoid noisy matches.
 */
function textContainsExpectedCategory(text, expectedCategory) {
  const needle = normalizeCategoryMatchString(expectedCategory);
  if (needle.length < 3) {
    return false;
  }
  const hay = normalizeCategoryMatchString(text);
  if (!hay) {
    return false;
  }
  return hay.includes(needle);
}

/**
 * If the search category clearly appears in the listing name or Maps categories, skip the LLM.
 */
function categoryEvidentFromListing(raw, base, expectedCategory) {
  const trimmed = String(expectedCategory ?? "").trim();
  if (!trimmed) {
    return false;
  }
  if (base.name && textContainsExpectedCategory(base.name, trimmed)) {
    return true;
  }
  const mapsCategory =
    pick(raw, "main_category", "MAIN_CATEGORY") ?? base.main_category ?? "";
  if (mapsCategory && textContainsExpectedCategory(mapsCategory, trimmed)) {
    return true;
  }
  const cats = pick(raw, "categories", "CATEGORIES");
  if (Array.isArray(cats)) {
    for (const c of cats) {
      if (c != null && textContainsExpectedCategory(String(c), trimmed)) {
        return true;
      }
    }
  } else if (cats != null && String(cats).trim()) {
    if (textContainsExpectedCategory(String(cats), trimmed)) {
      return true;
    }
  }
  return false;
}

/** Handles prose + JSON; free models often prepend reasoning. */
function parseInCategoryFromResponse(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  const quoted = /"in_category"\s*:\s*(true|false)/i.exec(text);
  if (quoted) {
    return quoted[1].toLowerCase() === "true";
  }
  const loose = /\bin_category\b\s*[:=]\s*(true|false)\b/i.exec(text);
  if (loose) {
    return loose[1].toLowerCase() === "true";
  }
  return parseInCategoryJson(text);
}

/**
 * Lenient check: only drop obvious mismatches. Free models often mis-read YES/NO;
 * we use JSON and fail-open (allow) on parse errors.
 */
async function validateBusinessInCategory(raw, base, expectedCategory) {
  if (categoryEvidentFromListing(raw, base, expectedCategory)) {
    return true;
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error(
      "OPENROUTER_API_KEY missing — skipping category validation (allowing row)",
    );
    return true;
  }
  const mapsCategory =
    pick(raw, "main_category", "MAIN_CATEGORY") ?? base.main_category ?? "";
  const cats = pick(raw, "categories", "CATEGORIES");
  const categoriesStr = Array.isArray(cats)
    ? cats.slice(0, 12).join(", ")
    : cats
      ? String(cats)
      : "";
  const area = [base.address, base.city, base.state, base.postal_code]
    .filter(Boolean)
    .join(", ");

  const prompt = `We scraped Google Maps for: "${expectedCategory}".

Listing:
- Name: ${base.name ?? "unknown"}
- Main category: ${mapsCategory || "unknown"}
- Other categories: ${categoriesStr || "none"}
- Location: ${area || "unknown"}

Decide if this listing is a REASONABLE result for someone searching "${expectedCategory}".

INCLUDE (in_category true): listings that genuinely offer "${expectedCategory}" services or closely related work (same trade / customer intent).

EXCLUDE (in_category false) ONLY when clearly unrelated to "${expectedCategory}".

When unsure, prefer in_category true (avoid false negatives).

Your entire reply must be only: {"in_category":true} or {"in_category":false}`;

  const jsonObjectMode = process.env.OPENROUTER_VALIDATION_JSON_OBJECT === "1";
  const validationModel = getOpenRouterValidationModel();

  try {
    let text;
    try {
      text = await openRouterChat(
        [
          { role: "system", content: VALIDATION_SYSTEM },
          { role: "user", content: prompt },
        ],
        48,
        { temperature: 0, jsonObjectMode, model: validationModel },
      );
    } catch (e) {
      if (jsonObjectMode) {
        text = await openRouterChat(
          [
            { role: "system", content: VALIDATION_SYSTEM },
            { role: "user", content: prompt },
          ],
          48,
          { temperature: 0, jsonObjectMode: false, model: validationModel },
        );
      } else {
        throw e;
      }
    }
    const parsed = parseInCategoryFromResponse(text);
    const ok = parsed !== null ? parsed : true;
    if (parsed === null) {
      console.error(
        "OpenRouter validation: could not parse in_category, allowing row. Raw:",
        (text || "").slice(0, 160),
      );
    }
    return ok;
  } catch (e) {
    console.error("OpenRouter validation error:", e.message ?? e);
    return true;
  }
}

function getNegativeReviewTexts(row) {
  const fr = pick(row, "featured_reviews", "FEATURED_REVIEWS");
  if (!Array.isArray(fr)) return [];
  const texts = [];
  for (const rev of fr) {
    const rating = toNum(pick(rev, "rating", "RATING"));
    if (rating !== 1 && rating !== 2) continue;
    const txt = pick(rev, "review_text", "text", "reviewText");
    if (txt && String(txt).trim()) {
      texts.push(String(txt).trim());
    }
  }
  return texts;
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

function extractReviewHighlights(row, max = 5) {
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
    const excerpt = t.slice(0, maxLen).trim();
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

function extractServicesOffered(raw, base) {
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

function extractHoursData(raw) {
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

async function summarizeWeaknessesWithOpenRouter(reviewTexts) {
  const joined = reviewTexts.join(" | ");
  const content = await openRouterCompletion(
    `Based on these negative customer reviews, summarize the top 3 complaints in one sentence each. Be specific and concise. Reviews: ${joined}`,
    150,
  );
  return content || null;
}

/** Facebook URL comes only from GMaps + enable_emails_social (no separate FB page scrape). */

async function main() {
  loadEnvLocal();
  const supabase = getSupabase();

  const { data: jobs, error: qErr } = await supabase
    .from(SCRAPE_JOBS_TABLE)
    .select("id, task_id, business_type, zip_code, status, loaded_at")
    .eq("status", "completed")
    .is("loaded_at", null);

  if (qErr) {
    throw new Error(qErr.message);
  }

  if (!jobs?.length) {
    console.log("Done. 0 businesses upserted across 0 jobs");
    console.log(
      "Stats: rows_seen=0, payload_candidates=0, skipped_no_place_id=0, skipped_has_website=0, skipped_not_in_category=0, skipped_sweet_spot=0, row_errors=0, upsert_batch_errors=0",
    );
    return;
  }

  let businessesUpserted = 0;
  let jobsCompleted = 0;
  let rowsSeen = 0;
  let payloadCandidates = 0;
  let skippedNoPlaceId = 0;
  let skippedHasWebsite = 0;
  let skippedNotInCategory = 0;
  let skippedSweetSpot = 0;
  let rowErrors = 0;
  let upsertBatchErrors = 0;

  for (const job of jobs) {
    try {
      const rows = await fetchAllTaskResults(job.task_id);
      rowsSeen += rows.length;
      const jobSearchUrl = mapsSearchLinkForZip(job.business_type, job.zip_code);
      console.log(
        `Processing ${job.business_type} in ${job.zip_code} — ${rows.length} businesses found`,
      );

      const payloads = [];
      for (const raw of rows) {
        try {
          const mainCategory = pick(raw, "main_category", "MAIN_CATEGORY");
          const businessType =
            resolveBusinessTypeFromMapsSearch(jobSearchUrl, mainCategory) ??
            job.business_type;
          const base = rowToBusiness(raw, businessType);
          applyLocationFallbacks(base, raw);
          if (!base.place_id) {
            console.error("Skipping row without place_id");
            skippedNoPlaceId += 1;
            continue;
          }
          if (base.has_website === true) {
            console.log(
              `Skipping (has website): ${base.name ?? base.place_id}`,
            );
            skippedHasWebsite += 1;
            continue;
          }

          try {
            await enrichLocationAsync(base, { scrapeZip: job.zip_code });
          } catch (locErr) {
            console.error(
              `Location enrich (${base.name ?? base.place_id}):`,
              locErr.message ?? locErr,
            );
          }

          const inCategory = ENABLE_CATEGORY_VALIDATION
            ? await validateBusinessInCategory(raw, base, job.business_type)
            : true;
          if (!inCategory) {
            console.log(
              `Skipping (not in category "${job.business_type}"): ${base.name ?? base.place_id}`,
            );
            skippedNotInCategory += 1;
            continue;
          }

          if (!passesSweetSpotFilters(base.rating, base.reviews)) {
            console.log(
              `Skipping (sweet spot ${process.env.SWEET_SPOT_MIN_RATING ?? 4}+ stars, ${process.env.SWEET_SPOT_MIN_REVIEWS ?? 10}–${process.env.SWEET_SPOT_MAX_REVIEWS ?? 200} reviews): ${base.name ?? base.place_id}`,
            );
            skippedSweetSpot += 1;
            continue;
          }

          const negatives = getNegativeReviewTexts(raw);
          let competitive_weakness = null;
          if (ENABLE_WEAKNESS_SUMMARY && negatives.length > 0) {
            try {
              competitive_weakness =
                await summarizeWeaknessesWithOpenRouter(negatives);
            } catch (orErr) {
              console.error("OpenRouter summarize error:", orErr.message ?? orErr);
              competitive_weakness = null;
            }
          }

          const payload = omitUndefined({
            ...base,
            facebook_url: base.facebook_url ?? undefined,
            competitive_weakness,
            review_highlights: extractReviewHighlights(
              raw,
              Number(process.env.REVIEW_HIGHLIGHTS_LIMIT ?? 5),
            ),
            services_offered: extractServicesOffered(raw, base),
            ...extractHoursData(raw),
            review_highlights_updated_at: new Date().toISOString(),
            last_scraped_at: new Date().toISOString(),
          });

          payloads.push(payload);
          payloadCandidates += 1;
        } catch (rowErr) {
          console.error("Row error:", rowErr.message ?? rowErr);
          rowErrors += 1;
        }
      }

      try {
        await attachDemoSlugsToPayloads(supabase, BUSINESSES_TABLE, payloads);
      } catch (slugErr) {
        console.error("demo_slug assignment failed:", slugErr.message ?? slugErr);
        throw slugErr;
      }

      for (let i = 0; i < payloads.length; i += BUSINESSES_UPSERT_BATCH_SIZE) {
        const chunk = payloads.slice(i, i + BUSINESSES_UPSERT_BATCH_SIZE);
        const { error: upErr } = await supabase
          .from(BUSINESSES_TABLE)
          .upsert(chunk, { onConflict: "place_id" });
        if (upErr) {
          console.error(`Batch upsert failed (${chunk.length} rows):`, upErr.message);
          upsertBatchErrors += 1;
          continue;
        }
        businessesUpserted += chunk.length;
      }

      const { error: loadErr } = await supabase
        .from(SCRAPE_JOBS_TABLE)
        .update({ loaded_at: new Date().toISOString() })
        .eq("id", job.id);
      if (loadErr) {
        console.error(`Failed to set loaded_at for job ${job.id}:`, loadErr.message);
      } else {
        jobsCompleted += 1;
      }
    } catch (jobErr) {
      console.error(`Job ${job.id} (task ${job.task_id}):`, jobErr.message ?? jobErr);
    }
  }

  console.log(
    `Done. ${businessesUpserted} businesses upserted across ${jobsCompleted} jobs`,
  );
  console.log(
    `Stats: rows_seen=${rowsSeen}, payload_candidates=${payloadCandidates}, skipped_no_place_id=${skippedNoPlaceId}, skipped_has_website=${skippedHasWebsite}, skipped_not_in_category=${skippedNotInCategory}, skipped_sweet_spot=${skippedSweetSpot}, row_errors=${rowErrors}, upsert_batch_errors=${upsertBatchErrors}`,
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
