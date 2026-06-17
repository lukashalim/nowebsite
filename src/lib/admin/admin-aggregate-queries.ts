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

export interface AdminAnonymousCsvByPageRow {
  page_url: string;
  download_count: number;
  last_downloaded_at: string;
}

export interface AdminUserActivityRow {
  user_id: string;
  email: string | null;
  is_pro: boolean;
  first_login: string | null;
  last_login: string | null;
  marketing_opt_in: boolean;
  last_sign_in_at: string | null;
  csv_download_count: number;
  login_count: number;
  dm_count: number;
  sms_count: number;
  phone_call_count: number;
  demo_click_count: number;
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

export async function fetchAdminAnonymousCsvByPage(
  periodStart: string | null,
): Promise<AdminAnonymousCsvByPageRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_anonymous_csv_by_page", {
    p_period_start: periodStart,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    page_url: String(row.page_url ?? ""),
    download_count: Number(row.download_count ?? 0),
    last_downloaded_at: String(row.last_downloaded_at ?? ""),
  }));
}

export async function fetchAdminUserActivityReport(
  periodStart: string | null,
): Promise<AdminUserActivityRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_user_activity_report", {
    p_period_start: periodStart,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    user_id: String(row.user_id ?? ""),
    email: typeof row.email === "string" ? row.email : null,
    is_pro: row.is_pro === true,
    first_login:
      typeof row.first_login === "string" ? row.first_login : null,
    last_login:
      typeof row.last_login === "string" ? row.last_login : null,
    marketing_opt_in: row.marketing_opt_in === true,
    last_sign_in_at:
      typeof row.last_sign_in_at === "string" ? row.last_sign_in_at : null,
    csv_download_count: Number(row.csv_download_count ?? 0),
    login_count: Number(row.login_count ?? 0),
    dm_count: Number(row.dm_count ?? 0),
    sms_count: Number(row.sms_count ?? 0),
    phone_call_count: Number(row.phone_call_count ?? 0),
    demo_click_count: Number(row.demo_click_count ?? 0),
  }));
}

export function isUsageSegment(value: string): value is AdminUsageSegment {
  return (
    value === "anonymous" ||
    value === "free_logged_in" ||
    value === "paid"
  );
}
