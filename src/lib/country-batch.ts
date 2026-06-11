import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const SCRAPE_BATCHES_TABLE = "scrape_batches" as const;
export const SCRAPE_BATCH_LOCATIONS_TABLE = "scrape_batch_locations" as const;

export type CountryBatchStrategy = "per_state" | "per_zip3" | "all_zips";

export type CountryBatchStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type CountryBatchLocationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface ScrapeBatchRow {
  id: number;
  business_type: string;
  country: string;
  strategy: CountryBatchStrategy;
  state_filter: string | null;
  max_results_per_location: number;
  dry_run: boolean;
  status: CountryBatchStatus;
  total_locations: number;
  completed_locations: number;
  failed_locations: number;
  skipped_locations: number;
  rows_scraped: number;
  rows_emitted: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapeBatchLocationRow {
  id: number;
  batch_id: number;
  location_hint: string;
  state: string | null;
  status: CountryBatchLocationStatus;
  rows_scraped: number;
  rows_emitted: number;
  sweet_spot_fail: number;
  skipped_no_place_id: number;
  skipped_min_recent_reviews: number;
  has_website: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

const BATCH_COLUMNS =
  "id, business_type, country, strategy, state_filter, max_results_per_location, dry_run, status, total_locations, completed_locations, failed_locations, skipped_locations, rows_scraped, rows_emitted, error_message, started_at, finished_at, created_at, updated_at";

const LOCATION_COLUMNS =
  "id, batch_id, location_hint, state, status, rows_scraped, rows_emitted, sweet_spot_fail, skipped_no_place_id, skipped_min_recent_reviews, has_website, error_message, started_at, finished_at, created_at, updated_at";

export interface CreateBatchInput {
  businessType: string;
  country?: string;
  strategy: CountryBatchStrategy;
  stateFilter?: string | null;
  maxResultsPerLocation: number;
  dryRun?: boolean;
  totalLocations: number;
}

export async function createBatchRecord(
  input: CreateBatchInput,
): Promise<{ batch: ScrapeBatchRow | null; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from(SCRAPE_BATCHES_TABLE)
      .insert({
        business_type: input.businessType.trim(),
        country: input.country ?? "US",
        strategy: input.strategy,
        state_filter: input.stateFilter?.trim() || null,
        max_results_per_location: input.maxResultsPerLocation,
        dry_run: input.dryRun ?? false,
        status: "pending",
        total_locations: input.totalLocations,
      })
      .select(BATCH_COLUMNS)
      .single();

    if (error) {
      return { batch: null, error: error.message };
    }
    return { batch: data as ScrapeBatchRow, error: null };
  } catch (e) {
    return { batch: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function insertBatchLocations(
  batchId: number,
  locations: Array<{ locationHint: string; state: string | null; skipped?: boolean }>,
): Promise<{ error: string | null }> {
  if (locations.length === 0) {
    return { error: null };
  }
  try {
    const supabase = createSupabaseAdmin();
    const now = new Date().toISOString();
    const rows = locations.map((loc) => ({
      batch_id: batchId,
      location_hint: loc.locationHint,
      state: loc.state,
      status: loc.skipped ? "skipped" : "pending",
      finished_at: loc.skipped ? now : null,
    }));
    const { error } = await supabase.from(SCRAPE_BATCH_LOCATIONS_TABLE).insert(rows);
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchBatchById(
  batchId: number,
): Promise<{ batch: ScrapeBatchRow | null; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from(SCRAPE_BATCHES_TABLE)
      .select(BATCH_COLUMNS)
      .eq("id", batchId)
      .maybeSingle();
    if (error) {
      return { batch: null, error: error.message };
    }
    return { batch: (data as ScrapeBatchRow | null) ?? null, error: null };
  } catch (e) {
    return { batch: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchRecentBatches(
  limit = 20,
): Promise<{ batches: ScrapeBatchRow[]; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from(SCRAPE_BATCHES_TABLE)
      .select(BATCH_COLUMNS)
      .order("id", { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)));
    if (error) {
      return { batches: [], error: error.message };
    }
    return { batches: (data ?? []) as ScrapeBatchRow[], error: null };
  } catch (e) {
    return { batches: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchBatchLocations(
  batchId: number,
  limit = 200,
): Promise<{ locations: ScrapeBatchLocationRow[]; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from(SCRAPE_BATCH_LOCATIONS_TABLE)
      .select(LOCATION_COLUMNS)
      .eq("batch_id", batchId)
      .order("id", { ascending: true })
      .limit(Math.min(500, Math.max(1, limit)));
    if (error) {
      return { locations: [], error: error.message };
    }
    return { locations: (data ?? []) as ScrapeBatchLocationRow[], error: null };
  } catch (e) {
    return { locations: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchActiveBatch(): Promise<{
  batch: ScrapeBatchRow | null;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from(SCRAPE_BATCHES_TABLE)
      .select(BATCH_COLUMNS)
      .in("status", ["pending", "running"])
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { batch: null, error: error.message };
    }
    return { batch: (data as ScrapeBatchRow | null) ?? null, error: null };
  } catch (e) {
    return { batch: null, error: e instanceof Error ? e.message : String(e) };
  }
}
