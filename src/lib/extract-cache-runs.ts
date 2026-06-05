import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface ExtractLocalCacheRunRow {
  id: number;
  run_at: string;
  duration_ms: number;
  exit_code: number;
  extractor_root: string | null;
  business_type: string | null;
  dry_run: boolean;
  businesses_target_table: string | null;
  cache_files_scanned: number;
  lines_read: number;
  skipped_no_place_id: number;
  skipped_duplicate_place: number;
  skipped_has_website: number;
  skipped_sweet_spot: number;
  skipped_min_recent_reviews: number;
  matched_leads: number;
  businesses_upserted: number;
  upsert_batch_errors: number;
  json_parse_errors: number;
  files_deleted: number;
  files_delete_failed: number;
  pending_cache_deletes: number;
  error_message: string | null;
  filter_snapshot: Record<string, unknown> | null;
}

const RUN_COLUMNS =
  "id, run_at, duration_ms, exit_code, extractor_root, business_type, dry_run, businesses_target_table, cache_files_scanned, lines_read, skipped_no_place_id, skipped_duplicate_place, skipped_has_website, skipped_sweet_spot, skipped_min_recent_reviews, matched_leads, businesses_upserted, upsert_batch_errors, json_parse_errors, files_deleted, files_delete_failed, pending_cache_deletes, error_message, filter_snapshot";

/** Skipped: fewer than min recent reviews (column or legacy filter_snapshot). */
export function skippedMinRecentReviewsCount(
  r: ExtractLocalCacheRunRow,
): number {
  const col = r.skipped_min_recent_reviews ?? 0;
  const snap = r.filter_snapshot;
  if (!snap || typeof snap !== "object") {
    return col;
  }
  const block =
    (snap.minRecentReviews as Record<string, unknown> | undefined) ??
    (snap.minReviewsInCalendarYear as Record<string, unknown> | undefined);
  const skipped = block?.skipped;
  const fromSnap =
    typeof skipped === "number" && Number.isFinite(skipped) ? skipped : 0;
  return Math.max(col, fromSnap);
}

export async function fetchExtractLocalCacheRuns(
  limit = 100,
): Promise<{ rows: ExtractLocalCacheRunRow[]; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("extract_local_cache_runs")
      .select(RUN_COLUMNS)
      .order("run_at", { ascending: false })
      .limit(Math.min(500, Math.max(1, limit)));

    if (error) {
      return { rows: [], error: error.message };
    }
    return { rows: (data ?? []) as ExtractLocalCacheRunRow[], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], error: msg };
  }
}
