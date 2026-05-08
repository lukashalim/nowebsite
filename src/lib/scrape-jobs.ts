import { createSupabaseAdmin } from "@/lib/supabase/admin";

/** Matches `public.scrape_jobs_nowebsite` — see `scrape/sql/create-scrape-jobs-nowebsite.sql`. */
export const SCRAPE_JOBS_TABLE = "scrape_jobs_nowebsite" as const;

const SCRAPE_JOB_COLUMNS =
  "id, task_id, business_type, zip_code, status, loaded_at, created_at, updated_at";

export interface ScrapeJobRow {
  id: number;
  task_id: number;
  business_type: string;
  zip_code: string | null;
  status: string;
  loaded_at: string | null;
  created_at: string;
  updated_at: string;
}

const KNOWN_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
] as const;

export interface ScrapeJobsSummary {
  byStatus: Record<string, number>;
  completedNotLoaded: number;
  loadedTotal: number;
  lastUpdatedAt: string | null;
  lastLoadedAt: string | null;
}

function clampLimit(limit: number): number {
  return Math.min(500, Math.max(1, limit));
}

export async function fetchScrapeJobsRecent(
  limit = 100,
): Promise<{ rows: ScrapeJobRow[]; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from(SCRAPE_JOBS_TABLE)
      .select(SCRAPE_JOB_COLUMNS)
      .order("id", { ascending: false })
      .limit(clampLimit(limit));

    if (error) {
      return { rows: [], error: error.message };
    }
    return { rows: (data ?? []) as ScrapeJobRow[], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], error: msg };
  }
}

export async function fetchScrapeJobsSummary(): Promise<{
  summary: ScrapeJobsSummary | null;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseAdmin();

    const [
      totalRes,
      pendingRes,
      inProgressRes,
      completedRes,
      failedRes,
      completedNotLoadedRes,
      loadedTotalRes,
      lastUpdatedRes,
      lastLoadedRes,
    ] = await Promise.all([
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("*", { count: "exact", head: true }),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("*", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .is("loaded_at", null),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("*", { count: "exact", head: true })
        .not("loaded_at", "is", null),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from(SCRAPE_JOBS_TABLE)
        .select("loaded_at")
        .not("loaded_at", "is", null)
        .order("loaded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const headErr = [
      totalRes.error,
      pendingRes.error,
      inProgressRes.error,
      completedRes.error,
      failedRes.error,
      completedNotLoadedRes.error,
      loadedTotalRes.error,
    ].find((e) => e != null);
    if (headErr) {
      return { summary: null, error: headErr.message };
    }

    const total = totalRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    const inProgress = inProgressRes.count ?? 0;
    const completed = completedRes.count ?? 0;
    const failed = failedRes.count ?? 0;
    const other = Math.max(0, total - pending - inProgress - completed - failed);

    const byStatus: Record<string, number> = {};
    for (const s of KNOWN_STATUSES) {
      const n =
        s === "pending"
          ? pending
          : s === "in_progress"
            ? inProgress
            : s === "completed"
              ? completed
              : failed;
      byStatus[s] = n;
    }
    byStatus.other = other;

    if (lastUpdatedRes.error) {
      return { summary: null, error: lastUpdatedRes.error.message };
    }
    if (lastLoadedRes.error) {
      return { summary: null, error: lastLoadedRes.error.message };
    }

    const lastUpdatedRow = lastUpdatedRes.data as { updated_at: string } | null;
    const lastLoadedRow = lastLoadedRes.data as { loaded_at: string } | null;

    return {
      summary: {
        byStatus,
        completedNotLoaded: completedNotLoadedRes.count ?? 0,
        loadedTotal: loadedTotalRes.count ?? 0,
        lastUpdatedAt: lastUpdatedRow?.updated_at ?? null,
        lastLoadedAt: lastLoadedRow?.loaded_at ?? null,
      },
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { summary: null, error: msg };
  }
}
