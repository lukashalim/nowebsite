import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface UsIndexBucket {
  city: string;
  state: string;
  main_category: string | null;
  business_type: string | null;
  listing_count: number;
  last_modified_at: string | null;
}

export interface UsCityIndexRow {
  city: string;
  state: string;
  listing_count: number;
  last_modified_at: string | null;
}

export interface UsCategoryIndexRow {
  main_category: string | null;
  business_type: string | null;
  listing_count: number;
  last_modified_at: string | null;
}

export interface UsStateIndexRow {
  state: string;
  listing_count: number;
  last_modified_at: string | null;
}

export interface GbCityIndexRow {
  city: string;
  state: string;
  region: string | null;
  region_code: string | null;
  listing_count: number;
  last_modified_at: string | null;
}

export interface GbRegionIndexRow {
  region: string;
  state: string;
  region_code: string | null;
  listing_count: number;
  last_modified_at: string | null;
}

export interface GbCategoryIndexRow {
  main_category: string | null;
  business_type: string | null;
  listing_count: number;
  last_modified_at: string | null;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toTimestamp(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

const INDEX_BUCKET_BATCH = 1000;

function mapUsCityIndexRow(row: Record<string, unknown>): UsCityIndexRow {
  return {
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    listing_count: toNumber(row.listing_count),
    last_modified_at: toTimestamp(row.last_modified_at),
  };
}

function mapUsCategoryIndexRow(row: Record<string, unknown>): UsCategoryIndexRow {
  return {
    main_category:
      typeof row.main_category === "string" ? row.main_category : null,
    business_type:
      typeof row.business_type === "string" ? row.business_type : null,
    listing_count: toNumber(row.listing_count),
    last_modified_at: toTimestamp(row.last_modified_at),
  };
}

function mapUsStateIndexRow(row: Record<string, unknown>): UsStateIndexRow {
  return {
    state: String(row.state ?? ""),
    listing_count: toNumber(row.listing_count),
    last_modified_at: toTimestamp(row.last_modified_at),
  };
}

function mapGbCityIndexRow(row: Record<string, unknown>): GbCityIndexRow {
  return {
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    region: typeof row.region === "string" ? row.region : null,
    region_code: typeof row.region_code === "string" ? row.region_code : null,
    listing_count: toNumber(row.listing_count),
    last_modified_at: toTimestamp(row.last_modified_at),
  };
}

function mapGbRegionIndexRow(row: Record<string, unknown>): GbRegionIndexRow {
  return {
    region: String(row.region ?? ""),
    state: String(row.state ?? ""),
    region_code: typeof row.region_code === "string" ? row.region_code : null,
    listing_count: toNumber(row.listing_count),
    last_modified_at: toTimestamp(row.last_modified_at),
  };
}

function mapGbCategoryIndexRow(row: Record<string, unknown>): GbCategoryIndexRow {
  return {
    main_category:
      typeof row.main_category === "string" ? row.main_category : null,
    business_type:
      typeof row.business_type === "string" ? row.business_type : null,
    listing_count: toNumber(row.listing_count),
    last_modified_at: toTimestamp(row.last_modified_at),
  };
}

async function fetchRpcRowsBatched<T>(
  rpcName: string,
  mapRow: (row: Record<string, unknown>) => T,
  args?: Record<string, unknown>,
): Promise<T[]> {
  const supabase = createSupabaseAdmin();
  const rows: T[] = [];
  let from = 0;
  const maxPages = 50;

  for (let page = 0; page < maxPages; page++) {
    const query = args
      ? supabase.rpc(rpcName, args)
      : supabase.rpc(rpcName);
    const { data, error } = await query.range(from, from + INDEX_BUCKET_BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []).map((row: Record<string, unknown>) =>
      mapRow(row),
    );
    if (batch.length === 0) break;

    // PostgREST may ignore .range() on some RPCs; stop if a page repeats.
    const prevStart = rows.length - batch.length;
    if (
      prevStart >= 0 &&
      batch.length === INDEX_BUCKET_BATCH &&
      rows.length >= batch.length
    ) {
      const prevBatch = rows.slice(prevStart, prevStart + batch.length);
      const repeats =
        JSON.stringify(prevBatch) === JSON.stringify(batch);
      if (repeats) break;
    }

    rows.push(...batch);
    if (batch.length < INDEX_BUCKET_BATCH) break;
    from += INDEX_BUCKET_BATCH;
  }

  return rows;
}

/** City-level counts (GROUP BY city, state). With minListings=50 returns ~55 hub rows. */
export async function fetchUsCityIndex(
  minListings = 0,
): Promise<UsCityIndexRow[]> {
  return fetchRpcRowsBatched(
    "directory_us_city_index",
    mapUsCityIndexRow,
    { min_listings: minListings },
  );
}

/** Nationwide category counts (~800 rows). */
export async function fetchUsCategoryIndex(): Promise<UsCategoryIndexRow[]> {
  return fetchRpcRowsBatched(
    "directory_us_category_index",
    mapUsCategoryIndexRow,
  );
}

/** State-level counts (~50 rows). */
export async function fetchUsStateIndex(): Promise<UsStateIndexRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_us_state_index");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) =>
    mapUsStateIndexRow(row),
  );
}

/** Per-city category breakdown for city hub pages. */
export async function fetchUsCityCategoryIndex(
  city: string,
  state: string,
): Promise<UsCategoryIndexRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_us_city_category_index", {
    p_city: city,
    p_state: state,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) =>
    mapUsCategoryIndexRow(row),
  );
}

export async function fetchGbCityIndex(
  minListings = 0,
): Promise<GbCityIndexRow[]> {
  return fetchRpcRowsBatched(
    "directory_gb_city_index",
    mapGbCityIndexRow,
    { min_listings: minListings },
  );
}

export async function fetchGbRegionIndex(
  minListings = 0,
): Promise<GbRegionIndexRow[]> {
  return fetchRpcRowsBatched(
    "directory_gb_region_index",
    mapGbRegionIndexRow,
    { min_listings: minListings },
  );
}

export async function fetchGbCityCategoryIndex(
  city: string,
  regionCode: string,
): Promise<GbCategoryIndexRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_gb_city_category_index", {
    p_city: city,
    p_region_code: regionCode,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) =>
    mapGbCategoryIndexRow(row),
  );
}


export async function fetchDirectoryUsListingTotal(): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_us_listing_total");
  if (error) {
    throw new Error(error.message);
  }
  return toNumber(data);
}

export async function fetchDirectoryFreshnessMax(): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_freshness_max");
  if (error) {
    throw new Error(error.message);
  }
  return typeof data === "string" ? data : null;
}

export async function fetchFacebookDirectoryListingTotal(): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_facebook_listing_total");
  if (error) {
    throw new Error(error.message);
  }
  return toNumber(data);
}

export async function fetchDirectoryGbListingTotal(): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_gb_listing_total");
  if (error) {
    throw new Error(error.message);
  }
  return toNumber(data);
}

export async function fetchCrmDistinctFilterValues(): Promise<
  { main_category: string; state: string }[]
> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("crm_distinct_filter_values");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? [])
    .map((row: Record<string, unknown>) => ({
      main_category: String(row.main_category ?? "").trim(),
      state: String(row.state ?? "").trim(),
    }))
    .filter(
      (row: { main_category: string; state: string }) =>
        row.main_category && row.state,
    );
}

export function bumpFreshnessIsoFromCandidate(
  current: string | null,
  candidate: string | null,
): string | null {
  if (!candidate) return current;
  if (!current || candidate > current) return candidate;
  return current;
}
