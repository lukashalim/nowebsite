/**
 * Read google_maps_scraper NDJSON from the Google Maps Extractor desktop app
 * (%AppData%/Roaming/googlemapsextractor/task_results/cache) and emit businesses
 * that match core filters (no website by default, min rating; no review count band).
 *
 * Usage (from scrape/):
 *   node extract-local-extractor-cache.mjs --business-type "Appliance repair"
 *
 * Env:
 *   GOOGLE_MAPS_EXTRACTOR_DIR — app root or .../task_results/cache (default: %APPDATA%/googlemapsextractor on Windows)
 *   SWEET_SPOT_MIN_RATING — default 4 (review min/max band is not applied here; see pipeline.mjs)
 *   SCRAPE_MIN_REVIEWS_IN_CALENDAR_YEAR — default 1 (need this many reviews dated in the filter year; set 2+ to tighten)
 *   SCRAPE_REVIEWS_YEAR_FILTER — calendar year (default: current year, e.g. 2026)
 *   SCRAPE_SKIP_MIN_REVIEWS_IN_CALENDAR_YEAR_FILTER=1 — disable the year review count gate
 *   EXTRACT_LOCAL_COUNTRY — optional US|GB; default per-row detection
 *   EXTRACT_LOCAL_LOCATION_HINT — US 5-digit ZIP or UK postcode when NDJSON lacks locality
 *   EXTRACT_LOCAL_SCRAPE_ZIP — deprecated alias for EXTRACT_LOCAL_LOCATION_HINT
 *
 * Flags:
 *   --root <path>              — same as GOOGLE_MAPS_EXTRACTOR_DIR
 *   --business-type <text>     — stored on rows as business_type (metadata only here)
 *   --include-tasks            — also scan task_results/tasks/*.ndjson (dedupe by place_id)
 *   --allow-website            — do not skip rows with a website
 *   --no-sweet-spot            — skip min-rating filter
 *   --format jsonl|csv         — with --dry-run, print matches (default jsonl)
 *   --max-files N              — only read the first N cache files (sorted by name), for testing
 *   --keep-files               — do not delete .ndjson after a file is fully read (default: delete to save disk)
 *   --dry-run                  — do not write to Supabase or delete cache files; print matches to stdout
 *
 * By default, matching rows are upserted into Supabase `businesses_nowebsite` (or BUSINESSES_TABLE). Env matches
 * pipeline.mjs: BUSINESSES_TABLE, BUSINESSES_UPSERT_BATCH_SIZE.
 *
 * Payload columns: core `rowToBusiness` fields + `facebook_url` only, unless
 * EXTRACT_LOCAL_INCLUDE_DEMO_SEO_FIELDS=1 (then adds review_highlights, services_offered, hours, open_now).
 *
 * After each file is read to EOF successfully, the script removes that .ndjson. Cache entries under
 * task_results/cache_storage.json for deleted cache/*.ndjson files are removed in one write at the end.
 *
 * Run log: each execution appends a row to Supabase `extract_local_cache_runs` (see scrape/sql).
 * Set EXTRACT_LOCAL_DISABLE_RUN_LOG=1 to skip inserts.
 *
 * Category stats: each run additively updates `category_content` (business_in_category,
 * business_without_website, website_adoption_pct) from the Maps sample before cohort filters.
 * Set EXTRACT_LOCAL_DISABLE_CATEGORY_STATS=1 to skip. Requires --business-type (not local_cache).
 * Additive counts may double-count place_id across runs; stats reflect extractor samples, not DB totals.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  loadEnvLocal,
  getSupabase,
  rowToBusiness,
  passesSweetSpotRatingFilter,
  passesMinReviewsInCalendarYear,
  getMinReviewsInCalendarYearFilterConfig,
  omitUndefined,
  parseBusinessTypeArg,
} from "./lib/scrape-pipeline/index.mjs";
import { buildBusinessUpsertPayload } from "./lib/business-payload-from-raw.mjs";
import {
  applyLocationFallbacks,
  enrichLocationAsync,
} from "./lib/location-fallbacks.mjs";
import {
  createDemoSlugAllocator,
  assignDemoSlugToPayload,
} from "./lib/demo-slug.mjs";
import {
  businessTypeArgToCategorySlug,
  humanizeDisplayName,
  isCategoryStatsDisabled,
  mergeCategoryContentStats,
} from "./lib/category-content-stats.mjs";
import {
  applyConversionUpdate,
  createExistingLookup,
  mergeTrackingIntoPayloadBatch,
  shouldRecordConversion,
} from "./lib/conversion-tracking.mjs";

const DEFAULT_WIN_EXTRACTOR_DIR = "googlemapsextractor";

/** Set at start of `main()` for crash logging in `.catch`. */
let currentExtractRunStartedMs = 0;

/**
 * App root is .../googlemapsextractor. Accept .../task_results/cache as well.
 * @param {string} resolved
 * @returns {string}
 */
function normalizeExtractorRoot(resolved) {
  const p = path.resolve(resolved);
  if (path.basename(p).toLowerCase() === "cache") {
    const oneUp = path.dirname(p);
    if (path.basename(oneUp).toLowerCase() === "task_results") {
      return path.dirname(oneUp);
    }
  }
  return p;
}

function defaultExtractorRoot() {
  const fromEnv = String(process.env.GOOGLE_MAPS_EXTRACTOR_DIR ?? "").trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return path.join(appData, DEFAULT_WIN_EXTRACTOR_DIR);
    }
  }
  return path.join(process.env.HOME || process.cwd(), DEFAULT_WIN_EXTRACTOR_DIR);
}

function parseRootArg(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const m = /^--root=(.*)$/.exec(arg);
    if (m) {
      return path.resolve(m[1].replace(/^['"]|['"]$/g, "").trim());
    }
    if (arg === "--root" && args[i + 1] && !args[i + 1].startsWith("--")) {
      return path.resolve(args[i + 1].replace(/^['"]|['"]$/g, "").trim());
    }
  }
  return null;
}

function hasFlag(argv, name) {
  return argv.slice(2).some((a) => a === name || a === `${name}=1` || a === `${name}=true`);
}

function envFlag(name, def = false) {
  const v = process.env[name];
  if (v == null) {
    return def;
  }
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    return true;
  }
  if (s === "0" || s === "false" || s === "no") {
    return false;
  }
  return def;
}

function parseFormat(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const m = /^--format=(.*)$/.exec(args[i]);
    if (m) {
      return m[1].trim().toLowerCase();
    }
    if (args[i] === "--format" && args[i + 1] && !args[i + 1].startsWith("--")) {
      return args[i + 1].trim().toLowerCase();
    }
  }
  return "jsonl";
}

/** @returns {number|null} */
function parseMaxFiles(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const m = /^--max-files=(\d+)$/.exec(args[i]);
    if (m) {
      return Math.max(1, parseInt(m[1], 10));
    }
    if (args[i] === "--max-files" && args[i + 1] && /^\d+$/.test(args[i + 1])) {
      return Math.max(1, parseInt(args[i + 1], 10));
    }
  }
  return null;
}

/** @param {string} dir */
function listNdjson(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ndjson"))
    .map((e) => path.join(dir, e.name));
}

/** @param {string} filePath */
async function* linesOfNdjson(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    yield t;
  }
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const BUSINESSES_UPSERT_BATCH_SIZE = Math.max(
  25,
  Number.parseInt(process.env.BUSINESSES_UPSERT_BATCH_SIZE ?? "100", 10) || 100,
);
const BUSINESSES_TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";

const DRY_RUN_COLUMNS = [
  "place_id",
  "name",
  "city",
  "state",
  "postal_code",
  "rating",
  "reviews",
  "phone",
  "main_category",
  "business_type",
  "google_maps_link",
];

function emptyRunStats(filesCount = 0) {
  return {
    files: filesCount,
    lines: 0,
    jsonErrors: 0,
    dupes: 0,
    noPlaceId: 0,
    hasWebsite: 0,
    sweetSpotFail: 0,
    skippedMinReviewsInYear: 0,
    emitted: 0,
    businessesUpserted: 0,
    upsertBatchErrors: 0,
    filesDeleted: 0,
    filesDeleteFailed: 0,
    categorySampleTotal: 0,
    categorySampleWithoutWebsite: 0,
    conversionsRecorded: 0,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} businessType
 * @param {ReturnType<typeof emptyRunStats>} stats
 * @param {boolean} dryRun
 * @returns {Promise<object|null>}
 */
async function applyCategoryContentStats(supabase, businessType, stats, dryRun) {
  if (isCategoryStatsDisabled()) {
    return { skipped: true, reason: "EXTRACT_LOCAL_DISABLE_CATEGORY_STATS" };
  }
  const slug = businessTypeArgToCategorySlug(businessType);
  if (!slug) {
    return { skipped: true, reason: "no category slug for business type" };
  }
  const runInCategory = stats.categorySampleTotal;
  const runWithoutWebsite = stats.categorySampleWithoutWebsite;
  if (runInCategory <= 0) {
    return { skipped: true, reason: "categorySampleTotal is 0", slug };
  }
  if (dryRun) {
    return {
      dryRun: true,
      slug,
      runInCategory,
      runWithoutWebsite,
    };
  }
  const result = await mergeCategoryContentStats(supabase, {
    slug,
    displayName: humanizeDisplayName(businessType),
    runInCategory,
    runWithoutWebsite,
  });
  return { slug, ...result };
}

/**
 * @param {object} p
 * @param {number} p.startedMs
 * @param {number} p.exitCode
 * @param {string} p.root
 * @param {string} p.businessType
 * @param {boolean} p.dryRun
 * @param {string|null} p.businessesTable
 * @param {boolean} p.deleteAfter
 * @param {boolean} p.allowWebsite
 * @param {boolean} p.noSweetSpot
 * @param {object} p.stats — counters from emptyRunStats()
 * @param {number} p.pendingCacheDeletes
 * @param {string|null} [p.errorMessage]
 */
async function persistExtractRunLog(p) {
  if (process.env.EXTRACT_LOCAL_DISABLE_RUN_LOG === "1") {
    return;
  }
  try {
    const db = getSupabase();
    const duration_ms = Math.max(0, Date.now() - p.startedMs);
    const yf = getMinReviewsInCalendarYearFilterConfig();
    const filter_snapshot = {
      allowWebsite: p.allowWebsite,
      noSweetSpot: p.noSweetSpot,
      sweetSpot: p.noSweetSpot
        ? null
        : {
            minRating: Number(process.env.SWEET_SPOT_MIN_RATING ?? 4),
          },
      minReviewsInCalendarYear: {
        ...yf,
        skipped: p.stats.skippedMinReviewsInYear ?? 0,
      },
    };
    const row = {
      duration_ms,
      exit_code: p.exitCode,
      extractor_root: p.root,
      business_type: p.businessType,
      dry_run: p.dryRun,
      businesses_target_table: p.dryRun ? null : p.businessesTable,
      cache_files_scanned: p.stats.files,
      lines_read: p.stats.lines,
      skipped_no_place_id: p.stats.noPlaceId,
      skipped_duplicate_place: p.stats.dupes,
      skipped_has_website: p.stats.hasWebsite,
      skipped_sweet_spot: p.stats.sweetSpotFail,
      matched_leads: p.stats.emitted,
      businesses_upserted: p.stats.businessesUpserted,
      upsert_batch_errors: p.stats.upsertBatchErrors,
      json_parse_errors: p.stats.jsonErrors,
      files_deleted: p.stats.filesDeleted,
      files_delete_failed: p.stats.filesDeleteFailed,
      pending_cache_deletes: p.pendingCacheDeletes,
      error_message: p.errorMessage ?? null,
      filter_snapshot,
    };
    const { error } = await db.from("extract_local_cache_runs").insert(row);
    if (error) {
      console.error("extract_local_cache_runs insert failed:", error.message);
    }
  } catch (e) {
    console.error("extract_local_cache_runs log:", e?.message ?? e);
  }
}

async function main() {
  const argv = process.argv;
  loadEnvLocal();
  const runStarted = Date.now();
  currentExtractRunStartedMs = runStarted;

  const root = normalizeExtractorRoot(parseRootArg(argv) ?? defaultExtractorRoot());
  const includeTasks = hasFlag(argv, "--include-tasks");
  const allowWebsite = hasFlag(argv, "--allow-website");
  const noSweetSpot = hasFlag(argv, "--no-sweet-spot");
  const keepFiles = hasFlag(argv, "--keep-files") || envFlag("EXTRACT_LOCAL_KEEP_FILES", false);
  const deleteAfter = !keepFiles;
  const dryRun = hasFlag(argv, "--dry-run");
  const format = parseFormat(argv);
  const businessType = parseBusinessTypeArg(argv) || "local_cache";

  const supabase = getSupabase();
  const existingLookup = createExistingLookup(supabase, BUSINESSES_TABLE);
  /** @type {object[]} */
  const payloadBuffer = [];
  /** @type {Promise<{ slugToPlace: Map<string, string>, placeToSlug: Map<string, string> }>|null} */
  let slugStatePromise = null;

  const cacheDir = path.join(root, "task_results", "cache");
  const tasksDir = path.join(root, "task_results", "tasks");
  let files = [
    ...listNdjson(cacheDir),
    ...(includeTasks ? listNdjson(tasksDir) : []),
  ].sort((a, b) => a.localeCompare(b));

  const maxFiles = parseMaxFiles(argv);
  if (maxFiles != null && files.length > maxFiles) {
    files = files.slice(0, maxFiles);
  }

  const seenPlace = new Set();
  const stats = emptyRunStats(files.length);

  if (files.length === 0) {
    const msg = `No .ndjson files under ${cacheDir}${includeTasks ? ` or ${tasksDir}` : ""}. Check GOOGLE_MAPS_EXTRACTOR_DIR / --root.`;
    console.error(msg);
    await persistExtractRunLog({
      startedMs: runStarted,
      exitCode: 1,
      root,
      businessType,
      dryRun,
      businessesTable: BUSINESSES_TABLE,
      deleteAfter,
      allowWebsite,
      noSweetSpot,
      stats,
      pendingCacheDeletes: 0,
      errorMessage: msg,
    });
    process.exit(1);
  }

  /**
   * @param {boolean} drainAll — if true, upsert any remainder (smaller than batch); if false, only when buffer is full batch
   */
  async function flushPayloadBuffer(drainAll) {
    if (dryRun) {
      return;
    }
    for (;;) {
      if (payloadBuffer.length === 0) {
        return;
      }
      if (!drainAll && payloadBuffer.length < BUSINESSES_UPSERT_BATCH_SIZE) {
        return;
      }
      const n = Math.min(BUSINESSES_UPSERT_BATCH_SIZE, payloadBuffer.length);
      const chunk = payloadBuffer.splice(0, n);
      if (!slugStatePromise) {
        slugStatePromise = createDemoSlugAllocator(supabase, BUSINESSES_TABLE);
      }
      const slugState = await slugStatePromise;
      for (const row of chunk) {
        assignDemoSlugToPayload(slugState, row);
      }
      try {
        const { conversionsRecorded } = await mergeTrackingIntoPayloadBatch(
          supabase,
          BUSINESSES_TABLE,
          chunk,
        );
        stats.conversionsRecorded += conversionsRecorded;
      } catch (trackErr) {
        console.error(
          `Conversion tracking (batch): ${trackErr?.message ?? trackErr}`,
        );
      }
      const { error: upErr } = await supabase
        .from(BUSINESSES_TABLE)
        .upsert(chunk, { onConflict: "place_id" });
      if (upErr) {
        stats.upsertBatchErrors += 1;
        console.error(`Batch upsert failed (${chunk.length} rows):`, upErr.message);
      } else {
        stats.businessesUpserted += chunk.length;
      }
    }
  }

  /** @type {string[]} NDJSON paths to unlink after successful Supabase upserts */
  const pendingFileDeletes = [];

  const norm = (p) => path.normalize(p);
  const isCacheFile = (fp) => norm(path.dirname(fp)) === norm(cacheDir);

  if (dryRun && format === "csv") {
    console.log(DRY_RUN_COLUMNS.join(","));
  }

  for (const filePath of files) {
    try {
      for await (const line of linesOfNdjson(filePath)) {
        stats.lines += 1;
        let raw;
        try {
          raw = JSON.parse(line);
        } catch {
          stats.jsonErrors += 1;
          continue;
        }

        const base = rowToBusiness(raw, businessType);
        const forcedCountry = process.env.EXTRACT_LOCAL_COUNTRY?.trim() || null;
        const locationHint =
          process.env.EXTRACT_LOCAL_LOCATION_HINT?.trim() ||
          process.env.EXTRACT_LOCAL_SCRAPE_ZIP?.trim() ||
          null;
        applyLocationFallbacks(base, raw, { forcedCountry });
        if (!base.place_id) {
          stats.noPlaceId += 1;
          continue;
        }
        if (seenPlace.has(base.place_id)) {
          stats.dupes += 1;
          continue;
        }
        seenPlace.add(base.place_id);

        stats.categorySampleTotal += 1;
        if (!base.has_website) {
          stats.categorySampleWithoutWebsite += 1;
        }

        if (!allowWebsite && base.has_website === true) {
          const existing = await existingLookup.ensureOne(base.place_id);
          if (shouldRecordConversion(base, existing)) {
            try {
              await enrichLocationAsync(base, {
                locationHint,
                scrapeZip: locationHint,
                forcedCountry,
                country: base.country,
              });
            } catch (locErr) {
              console.error(
                `Location enrich (conversion ${base.name ?? base.place_id}):`,
                locErr.message ?? locErr,
              );
            }
            try {
              const converted = await applyConversionUpdate(
                supabase,
                BUSINESSES_TABLE,
                base,
                existing,
              );
              if (converted) {
                stats.conversionsRecorded += 1;
                console.log(
                  `Converted (website found): ${base.name ?? base.place_id}`,
                );
              }
            } catch (convErr) {
              console.error(
                `Conversion update (${base.place_id}):`,
                convErr?.message ?? convErr,
              );
            }
          } else {
            stats.hasWebsite += 1;
          }
          continue;
        }
        if (!noSweetSpot && !passesSweetSpotRatingFilter(base.rating)) {
          stats.sweetSpotFail += 1;
          continue;
        }

        if (!passesMinReviewsInCalendarYear(raw)) {
          stats.skippedMinReviewsInYear += 1;
          continue;
        }

        try {
          await enrichLocationAsync(base, {
            locationHint,
            scrapeZip: locationHint,
            forcedCountry,
            country: base.country,
          });
        } catch (locErr) {
          console.error(
            `Location enrich (${base.name ?? base.place_id}):`,
            locErr.message ?? locErr,
          );
        }

        const payload = buildBusinessUpsertPayload(raw, base);

        stats.emitted += 1;

        if (dryRun) {
          const out = omitUndefined({
            place_id: payload.place_id,
            name: payload.name,
            city: payload.city,
            state: payload.state,
            country: payload.country,
            postal_code: payload.postal_code,
            rating: payload.rating,
            reviews: payload.reviews,
            phone: payload.phone,
            main_category: payload.main_category,
            business_type: payload.business_type,
            google_maps_link: payload.google_maps_link,
          });
          if (format === "csv") {
            console.log(DRY_RUN_COLUMNS.map((c) => csvEscape(out[c])).join(","));
          } else {
            console.log(JSON.stringify(out));
          }
        } else {
          payloadBuffer.push(payload);
          await flushPayloadBuffer(false);
        }
      }

      await flushPayloadBuffer(true);

      if (deleteAfter && !dryRun) {
        pendingFileDeletes.push(filePath);
      }
    } catch (fileErr) {
      console.error(`Stopped on ${filePath} (file not deleted): ${fileErr?.message ?? fileErr}`);
      throw fileErr;
    }
  }

  await flushPayloadBuffer(true);

  /** @type {object|null} */
  let categoryContentStats = null;

  const buildStatPayload = () => ({
    root,
    ...stats,
    dryRun,
    businessesTable: dryRun ? null : BUSINESSES_TABLE,
    deleteAfter,
    pendingCacheDeletes: pendingFileDeletes.length,
    categoryContent: categoryContentStats,
    filters: {
      allowWebsite,
      noSweetSpot,
      sweetSpot: noSweetSpot
        ? null
        : {
            minRating: Number(process.env.SWEET_SPOT_MIN_RATING ?? 4),
          },
      minReviewsInCalendarYear: {
        ...getMinReviewsInCalendarYearFilterConfig(),
        skipped: stats.skippedMinReviewsInYear,
      },
    },
  });

  if (deleteAfter && !dryRun && pendingFileDeletes.length > 0) {
    if (stats.upsertBatchErrors > 0) {
      console.error(JSON.stringify(buildStatPayload(), null, 2));
      console.error(
        `Keeping ${pendingFileDeletes.length} cache file(s): fix Supabase upsert errors (${stats.upsertBatchErrors} batch failures), then re-run.`,
      );
      await persistExtractRunLog({
        startedMs: runStarted,
        exitCode: 1,
        root,
        businessType,
        dryRun,
        businessesTable: BUSINESSES_TABLE,
        deleteAfter,
        allowWebsite,
        noSweetSpot,
        stats,
        pendingCacheDeletes: pendingFileDeletes.length,
        errorMessage: `Supabase upsert: ${stats.upsertBatchErrors} batch failure(s); cache files not deleted.`,
      });
      process.exit(1);
    }
    const cacheBasenamesDeleted = [];
    for (const fp of pendingFileDeletes) {
      try {
        await fs.promises.unlink(fp);
        stats.filesDeleted += 1;
        if (isCacheFile(fp)) {
          cacheBasenamesDeleted.push(path.basename(fp));
        }
      } catch (unlinkErr) {
        stats.filesDeleteFailed += 1;
        console.error(`Could not delete ${fp}: ${unlinkErr?.message ?? unlinkErr}`);
      }
    }
    if (cacheBasenamesDeleted.length > 0) {
      const storagePath = path.join(root, "task_results", "cache_storage.json");
      try {
        if (fs.existsSync(storagePath)) {
          const rawJson = fs.readFileSync(storagePath, "utf8");
          const index = JSON.parse(rawJson);
          if (index && typeof index === "object" && !Array.isArray(index)) {
            for (const basename of cacheBasenamesDeleted) {
              delete index[basename];
            }
            fs.writeFileSync(
              storagePath,
              `${JSON.stringify(index, null, 4)}\n`,
              "utf8",
            );
          }
        }
      } catch (idxErr) {
        console.error(
          `cache_storage.json prune failed (${path.join(root, "task_results", "cache_storage.json")}): ${idxErr?.message ?? idxErr}`,
        );
      }
    }
  }

  try {
    categoryContentStats = await applyCategoryContentStats(
      supabase,
      businessType,
      stats,
      dryRun,
    );
  } catch (catErr) {
    console.error(
      "category_content stats failed:",
      catErr?.message ?? catErr,
    );
    categoryContentStats = {
      error: String(catErr?.message ?? catErr),
    };
  }

  console.error(JSON.stringify(buildStatPayload(), null, 2));

  await persistExtractRunLog({
    startedMs: runStarted,
    exitCode: 0,
    root,
    businessType,
    dryRun,
    businessesTable: BUSINESSES_TABLE,
    deleteAfter,
    allowWebsite,
    noSweetSpot,
    stats,
    pendingCacheDeletes: pendingFileDeletes.length,
    errorMessage: null,
  });
}

main().catch(async (e) => {
  console.error(e.message ?? e);
  const av = process.argv;
  try {
    await persistExtractRunLog({
      startedMs: currentExtractRunStartedMs || Date.now(),
      exitCode: 1,
      root: normalizeExtractorRoot(parseRootArg(av) ?? defaultExtractorRoot()),
      businessType: parseBusinessTypeArg(av) || "local_cache",
      dryRun: hasFlag(av, "--dry-run"),
      businessesTable: process.env.BUSINESSES_TABLE ?? "businesses",
      deleteAfter:
        !hasFlag(av, "--keep-files") && !envFlag("EXTRACT_LOCAL_KEEP_FILES", false),
      allowWebsite: hasFlag(av, "--allow-website"),
      noSweetSpot: hasFlag(av, "--no-sweet-spot"),
      stats: emptyRunStats(0),
      pendingCacheDeletes: 0,
      errorMessage: String(e?.message ?? e),
    });
  } catch {
    /* ignore secondary log failures */
  }
  process.exit(1);
});
