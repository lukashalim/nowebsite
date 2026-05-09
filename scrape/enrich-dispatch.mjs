/**
 * Queue contact/social enrichment for existing businesses (no ZIP crawl).
 * Uses google_maps_scraper with search_links = Maps URLs (+ BOTASAURUS_API_KEY).
 *
 * By default only rows meeting the same sweet-spot thresholds as pipeline.mjs:
 *   SWEET_SPOT_MIN_RATING (default 4), SWEET_SPOT_MIN_REVIEWS (10), SWEET_SPOT_MAX_REVIEWS (200)
 * Set ENRICH_IGNORE_SWEET_SPOT=1 to enqueue regardless of rating/reviews.
 *
 * Env:
 *   ENRICH_TOTAL_LIMIT — max rows to queue this run (default 500)
 *   ENRICH_LINKS_PER_TASK — Maps URLs per Botasaurus task (default 25)
 *   ENRICH_DISPATCH_SLEEP_MS — pause between tasks (default 5000)
 *   ENRICH_FORCE=1 — include rows that already have enriched_at (re-enrich)
 *   ENRICH_FILTER_STATE — exact match businesses.state e.g. Florida
 *   ENRICH_FILTER_BUSINESS_TYPE — exact match business_type
 *
 * Usage:
 *   node enrich-dispatch.mjs
 *   node enrich-dispatch.mjs --limit=200
 */
import dns from "node:dns";
import {
  loadEnvLocal,
  getSupabase,
  sleep,
  extractLeafTaskId,
  buildGoogleMapsDispatchData,
  botasaurusFetch,
  getBotasaurusBase,
  mapsLinkFromBusinessRow,
} from "./lib/scrape-pipeline/index.mjs";

dns.setDefaultResultOrder("ipv4first");

function parseLimitArg(argv) {
  for (const arg of argv.slice(2)) {
    const m = /^--limit=(\d+)$/.exec(arg);
    if (m) return Number.parseInt(m[1], 10);
  }
  const env = process.env.ENRICH_TOTAL_LIMIT;
  if (env != null && String(env).trim() !== "") {
    const n = Number.parseInt(String(env), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 500;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const apiKey = String(process.env.BOTASAURUS_API_KEY ?? "").trim();
  if (!apiKey) {
    console.error("Set BOTASAURUS_API_KEY in .env.local for Omkar enrichment.");
    process.exit(1);
  }

  const totalLimit = parseLimitArg(process.argv);
  const perTask = Math.max(
    1,
    Number.parseInt(process.env.ENRICH_LINKS_PER_TASK ?? "25", 10) || 25,
  );
  const pauseMs = Math.max(
    0,
    Number.parseInt(process.env.ENRICH_DISPATCH_SLEEP_MS ?? "5000", 10) || 5000,
  );

  const stateFilter = process.env.ENRICH_FILTER_STATE?.trim() || null;
  const typeFilter = process.env.ENRICH_FILTER_BUSINESS_TYPE?.trim() || null;
  const enrichForce =
    process.env.ENRICH_FORCE === "1" || process.env.ENRICH_FORCE === "true";
  const ignoreSweetSpot =
    process.env.ENRICH_IGNORE_SWEET_SPOT === "1" ||
    process.env.ENRICH_IGNORE_SWEET_SPOT === "true";

  const minRating = Number(process.env.SWEET_SPOT_MIN_RATING ?? 4);
  const minReviews = Number(process.env.SWEET_SPOT_MIN_REVIEWS ?? 10);
  const maxReviews = Number(process.env.SWEET_SPOT_MAX_REVIEWS ?? 200);

  const supabase = getSupabase();

  let q = supabase
    .from("businesses")
    .select("place_id, google_maps_link, state, business_type, rating, reviews")
    .order("scraped_at", { ascending: true })
    .limit(totalLimit);

  if (!ignoreSweetSpot) {
    if (Number.isFinite(minRating)) {
      q = q.gte("rating", minRating);
    }
    if (Number.isFinite(minReviews)) {
      q = q.gte("reviews", minReviews);
    }
    if (Number.isFinite(maxReviews)) {
      q = q.lte("reviews", maxReviews);
    }
  }

  if (!enrichForce) {
    q = q.is("enriched_at", null);
  }
  if (stateFilter) {
    q = q.eq("state", stateFilter);
  }
  if (typeFilter) {
    q = q.eq("business_type", typeFilter);
  }

  const { data: rows, error } = await q;
  if (error) {
    throw new Error(error.message);
  }
  if (!rows?.length) {
    console.log(
      "No businesses matched filters (sweet-spot + optional state/type; try ENRICH_IGNORE_SWEET_SPOT=1 or ENRICH_FORCE=1).",
    );
    return;
  }

  const withLinks = [];
  for (const r of rows) {
    const url = mapsLinkFromBusinessRow(r);
    if (url) {
      withLinks.push({ ...r, _maps_url: url });
    }
  }
  if (!withLinks.length) {
    console.error("No rows with a derivable Maps URL (need google_maps_link or place_id).");
    process.exit(1);
  }

  const batches = chunk(withLinks, perTask);
  const thresholdNote = ignoreSweetSpot
    ? "no rating/reviews filter"
    : `rating≥${minRating}, reviews ${minReviews}–${maxReviews}`;
  console.error(
    `Enrichment dispatch (${thresholdNote}): ${withLinks.length} business(es) in ${batches.length} task(s) → ${getBotasaurusBase()}`,
  );

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const searchLinks = batch.map((b) => b._maps_url);
    const data = buildGoogleMapsDispatchData(
      searchLinks,
      Math.max(searchLinks.length, 20),
      { enableEmailsSocial: true },
    );

    try {
      const res = await botasaurusFetch(`${getBotasaurusBase()}/tasks/create-task-async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          scraper_name: "google_maps_scraper",
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const created = await res.json();
      const taskId = extractLeafTaskId(created);
      if (taskId == null) {
        console.error("No task id:", JSON.stringify(created).slice(0, 400));
        continue;
      }

      const { error: insErr } = await supabase.from("enrichment_jobs").insert({
        task_id: taskId,
        status: "pending",
      });
      if (insErr) {
        throw new Error(insErr.message);
      }

      console.log(
        `Batch ${i + 1}/${batches.length}: task ${taskId} (${searchLinks.length} links)`,
      );
    } catch (e) {
      console.error(`Batch ${i + 1} failed:`, e.message ?? e);
    }

    if (i < batches.length - 1 && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
