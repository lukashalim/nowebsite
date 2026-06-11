import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface UsIndexBucket {
  city: string;
  state: string;
  main_category: string | null;
  business_type: string | null;
  listing_count: number;
  last_modified_at: string | null;
}

export interface GbIndexBucket {
  city: string;
  state: string;
  region: string | null;
  region_code: string | null;
  main_category: string | null;
  business_type: string | null;
  listing_count: number;
  last_modified_at: string | null;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchUsIndexBuckets(): Promise<UsIndexBucket[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_us_index_buckets");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    main_category:
      typeof row.main_category === "string" ? row.main_category : null,
    business_type:
      typeof row.business_type === "string" ? row.business_type : null,
    listing_count: toNumber(row.listing_count),
    last_modified_at:
      typeof row.last_modified_at === "string" ? row.last_modified_at : null,
  }));
}

export async function fetchGbIndexBuckets(): Promise<GbIndexBucket[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_gb_index_buckets");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    region: typeof row.region === "string" ? row.region : null,
    region_code: typeof row.region_code === "string" ? row.region_code : null,
    main_category:
      typeof row.main_category === "string" ? row.main_category : null,
    business_type:
      typeof row.business_type === "string" ? row.business_type : null,
    listing_count: toNumber(row.listing_count),
    last_modified_at:
      typeof row.last_modified_at === "string" ? row.last_modified_at : null,
  }));
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
