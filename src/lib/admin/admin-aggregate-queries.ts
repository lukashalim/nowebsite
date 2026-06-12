import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type AdminUsageSegment = "anonymous" | "free_logged_in" | "paid";

export interface AdminUsageAudienceRow {
  registered_free: number;
  registered_pro: number;
  csv_only_emails: number;
}

export interface AdminCsvDownloadStatRow {
  segment: string;
  actor_key: string;
  download_count: number;
}

export interface AdminCrmUsageStatRow {
  segment: string;
  user_id: string;
  action_type: string;
  event_count: number;
}

export async function fetchAdminUsageAudienceCounts(): Promise<AdminUsageAudienceRow> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_usage_audience_counts");
  if (error) {
    throw new Error(error.message);
  }
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  return {
    registered_free: Number(row?.registered_free ?? 0),
    registered_pro: Number(row?.registered_pro ?? 0),
    csv_only_emails: Number(row?.csv_only_emails ?? 0),
  };
}

export async function fetchAdminCsvDownloadStats(
  periodStart: string | null,
): Promise<AdminCsvDownloadStatRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_csv_download_stats", {
    p_period_start: periodStart,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    segment: String(row.segment ?? ""),
    actor_key: String(row.actor_key ?? ""),
    download_count: Number(row.download_count ?? 0),
  }));
}

export async function fetchAdminCrmUsageStats(
  periodStart: string | null,
): Promise<AdminCrmUsageStatRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_crm_usage_stats", {
    p_period_start: periodStart,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    segment: String(row.segment ?? ""),
    user_id: String(row.user_id ?? ""),
    action_type: String(row.action_type ?? ""),
    event_count: Number(row.event_count ?? 0),
  }));
}

export function isUsageSegment(value: string): value is AdminUsageSegment {
  return (
    value === "anonymous" ||
    value === "free_logged_in" ||
    value === "paid"
  );
}
