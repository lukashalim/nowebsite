import {
  rowToBusiness,
  passesSweetSpotRatingFilter,
  passesMinRecentReviews,
  getMinRecentReviewsFilterConfig,
  omitUndefined,
  getSupabase,
} from "./scrape-pipeline/index.mjs";
import { buildBusinessUpsertPayload } from "./business-payload-from-raw.mjs";
import {
  applyLocationFallbacks,
  enrichLocationAsync,
} from "./location-fallbacks.mjs";
import {
  createDemoSlugAllocator,
  assignDemoSlugToPayload,
  isDemoSlugConflictError,
  reassignDemoSlugAfterConflict,
} from "./demo-slug.mjs";
import {
  businessTypeArgToCategorySlug,
  humanizeDisplayName,
  isCategoryStatsDisabled,
  mergeCategoryContentStats,
} from "./category-content-stats.mjs";
import {
  applyConversionUpdate,
  createExistingLookup,
  mergeTrackingIntoPayloadBatch,
  shouldRecordConversion,
} from "./conversion-tracking.mjs";

export const DRY_RUN_COLUMNS = [
  "place_id",
  "name",
  "city",
  "state",
  "country",
  "postal_code",
  "rating",
  "reviews",
  "phone",
  "main_category",
  "business_type",
  "google_maps_link",
];

export function emptyIngestStats(filesCount = 0) {
  return {
    files: filesCount,
    filesMissing: 0,
    lines: 0,
    jsonErrors: 0,
    dupes: 0,
    noPlaceId: 0,
    hasWebsite: 0,
    sweetSpotFail: 0,
    skippedMinRecentReviews: 0,
    emitted: 0,
    businessesUpserted: 0,
    upsertBatchErrors: 0,
    filesDeleted: 0,
    filesDeleteFailed: 0,
    tasksFilesDeleted: 0,
    tasksFilesDeleteFailed: 0,
    categorySampleTotal: 0,
    categorySampleWithoutWebsite: 0,
    conversionsRecorded: 0,
  };
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} businessType
 * @param {ReturnType<typeof emptyIngestStats>} stats
 * @param {boolean} dryRun
 */
export async function applyCategoryContentStats(supabase, businessType, stats, dryRun) {
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
 * @param {string|null} p.root
 * @param {string} p.businessType
 * @param {boolean} p.dryRun
 * @param {string|null} p.businessesTable
 * @param {boolean} p.allowWebsite
 * @param {boolean} p.noSweetSpot
 * @param {ReturnType<typeof emptyIngestStats>} p.stats
 * @param {number} [p.pendingCacheDeletes]
 * @param {string|null} [p.errorMessage]
 * @param {Record<string, unknown>} [p.filterSnapshotExtra]
 */
export async function persistExtractRunLog(p) {
  if (process.env.EXTRACT_LOCAL_DISABLE_RUN_LOG === "1") {
    return;
  }
  try {
    const db = getSupabase();
    const duration_ms = Math.max(0, Date.now() - p.startedMs);
    const rf = getMinRecentReviewsFilterConfig();
    const filter_snapshot = {
      allowWebsite: p.allowWebsite,
      noSweetSpot: p.noSweetSpot,
      sweetSpot: p.noSweetSpot
        ? null
        : {
            minRating: Number(process.env.SWEET_SPOT_MIN_RATING ?? 4),
          },
      minRecentReviews: {
        ...rf,
        skipped: p.stats.skippedMinRecentReviews ?? 0,
      },
      ...(p.filterSnapshotExtra ?? {}),
    };
    const row = {
      duration_ms,
      exit_code: p.exitCode,
      extractor_root: p.root ?? null,
      business_type: p.businessType,
      dry_run: p.dryRun,
      businesses_target_table: p.dryRun ? null : p.businessesTable,
      cache_files_scanned: p.stats.files,
      lines_read: p.stats.lines,
      skipped_no_place_id: p.stats.noPlaceId,
      skipped_duplicate_place: p.stats.dupes,
      skipped_has_website: p.stats.hasWebsite,
      skipped_sweet_spot: p.stats.sweetSpotFail,
      skipped_min_recent_reviews: p.stats.skippedMinRecentReviews ?? 0,
      matched_leads: p.stats.emitted,
      businesses_upserted: p.stats.businessesUpserted,
      upsert_batch_errors: p.stats.upsertBatchErrors,
      json_parse_errors: p.stats.jsonErrors,
      files_deleted: p.stats.filesDeleted,
      files_delete_failed: p.stats.filesDeleteFailed,
      pending_cache_deletes: p.pendingCacheDeletes ?? 0,
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

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase
 * @param {string} opts.businessesTable
 * @param {string} opts.businessType
 * @param {string|null} [opts.locationHint]
 * @param {string|null} [opts.forcedCountry]
 * @param {boolean} [opts.allowWebsite]
 * @param {boolean} [opts.noSweetSpot]
 * @param {boolean} [opts.dryRun]
 * @param {"jsonl"|"csv"} [opts.dryRunFormat]
 * @param {ReturnType<typeof emptyIngestStats>} [opts.stats]
 */
export function createIngestRunner(opts) {
  const {
    supabase,
    businessesTable,
    businessType,
    locationHint = null,
    forcedCountry = null,
    allowWebsite = false,
    noSweetSpot = false,
    dryRun = false,
    dryRunFormat = "jsonl",
    stats = emptyIngestStats(0),
  } = opts;

  const batchSize = Math.max(
    25,
    Number.parseInt(process.env.BUSINESSES_UPSERT_BATCH_SIZE ?? "100", 10) || 100,
  );

  const seenPlace = new Set();
  const existingLookup = createExistingLookup(supabase, businessesTable);
  /** @type {object[]} */
  const payloadBuffer = [];
  /** @type {Promise<{ slugToPlace: Map<string, string>, placeToSlug: Map<string, string> }>|null} */
  let slugStatePromise = null;

  async function upsertChunkRecursive(chunk, slugState) {
    if (chunk.length === 0) {
      return;
    }
    const { error: upErr } = await supabase
      .from(businessesTable)
      .upsert(chunk, { onConflict: "place_id" });
    if (!upErr) {
      stats.businessesUpserted += chunk.length;
      return;
    }
    if (chunk.length === 1) {
      const row = chunk[0];
      const placeId = row?.place_id ?? "?";
      if (
        slugState &&
        isDemoSlugConflictError(upErr.message) &&
        row &&
        typeof row === "object"
      ) {
        let resolved = false;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await reassignDemoSlugAfterConflict(
            supabase,
            businessesTable,
            slugState,
            row,
          );
          const { error: retryErr } = await supabase
            .from(businessesTable)
            .upsert([row], { onConflict: "place_id" });
          if (!retryErr) {
            stats.businessesUpserted += 1;
            resolved = true;
            break;
          }
          if (!isDemoSlugConflictError(retryErr.message)) {
            stats.upsertBatchErrors += 1;
            console.error(`Upsert failed (${placeId}):`, retryErr.message);
            return;
          }
        }
        if (resolved) {
          return;
        }
      }
      stats.upsertBatchErrors += 1;
      console.error(`Upsert failed (${placeId}):`, upErr.message);
      return;
    }
    const mid = Math.floor(chunk.length / 2);
    await upsertChunkRecursive(chunk.slice(0, mid), slugState);
    await upsertChunkRecursive(chunk.slice(mid), slugState);
  }

  async function flushPayloadBuffer(drainAll) {
    if (dryRun) {
      return;
    }
    for (;;) {
      if (payloadBuffer.length === 0) {
        return;
      }
      if (!drainAll && payloadBuffer.length < batchSize) {
        return;
      }
      const n = Math.min(batchSize, payloadBuffer.length);
      const chunk = payloadBuffer.splice(0, n);
      if (!slugStatePromise) {
        slugStatePromise = createDemoSlugAllocator(supabase, businessesTable);
      }
      const slugState = await slugStatePromise;
      for (const row of chunk) {
        assignDemoSlugToPayload(slugState, row);
      }
      try {
        const { conversionsRecorded } = await mergeTrackingIntoPayloadBatch(
          supabase,
          businessesTable,
          chunk,
        );
        stats.conversionsRecorded += conversionsRecorded;
      } catch (trackErr) {
        console.error(
          `Conversion tracking (batch): ${trackErr?.message ?? trackErr}`,
        );
      }
      await upsertChunkRecursive(chunk, slugState);
    }
  }

  /**
   * @param {Record<string, unknown>} raw
   */
  async function processRow(raw) {
    stats.lines += 1;

    const base = rowToBusiness(raw, businessType);
    applyLocationFallbacks(base, raw, { forcedCountry });
    if (!base.place_id) {
      stats.noPlaceId += 1;
      return;
    }
    if (seenPlace.has(base.place_id)) {
      stats.dupes += 1;
      return;
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
            businessesTable,
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
      return;
    }
    if (!noSweetSpot && !passesSweetSpotRatingFilter(base.rating)) {
      stats.sweetSpotFail += 1;
      return;
    }

    if (!passesMinRecentReviews(raw)) {
      stats.skippedMinRecentReviews += 1;
      return;
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
      if (dryRunFormat === "csv") {
        console.log(DRY_RUN_COLUMNS.map((c) => csvEscape(out[c])).join(","));
      } else {
        console.log(JSON.stringify(out));
      }
      return;
    }

    payloadBuffer.push(payload);
    await flushPayloadBuffer(false);
  }

  return {
    stats,
    processRow,
    flush: flushPayloadBuffer,
    printDryRunHeader() {
      if (dryRun && dryRunFormat === "csv") {
        console.log(DRY_RUN_COLUMNS.join(","));
      }
    },
  };
}

/**
 * Process an array of raw scraper rows in one pass.
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase
 * @param {Record<string, unknown>[]} opts.rows
 * @param {string} opts.businessesTable
 * @param {string} opts.businessType
 * @param {string} opts.locationHint
 * @param {string|null} [opts.forcedCountry]
 * @param {boolean} [opts.allowWebsite]
 * @param {boolean} [opts.noSweetSpot]
 * @param {boolean} [opts.dryRun]
 */
export async function ingestFilteredRows(opts) {
  const runner = createIngestRunner(opts);
  runner.printDryRunHeader();
  for (const raw of opts.rows) {
    await runner.processRow(raw);
  }
  await runner.flush(true);
  return runner.stats;
}
