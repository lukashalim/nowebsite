import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { CrmUsageAction, CrmUsageByAction } from "@/lib/crm-limits";
import { EMPTY_CRM_USAGE_BY_ACTION } from "@/lib/crm-limits";

export interface CrmUsageMonthlySummaryRow {
  action_type: string;
  event_count: number;
}

export async function fetchCrmUsageMonthlySummary(
  userId: string,
): Promise<CrmUsageMonthlySummaryRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("crm_usage_monthly_summary", {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    action_type: String(row.action_type ?? ""),
    event_count: Number(row.event_count ?? 0),
  }));
}

export async function fetchCrmUsageMonthlyTotal(userId: string): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("crm_usage_monthly_total", {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}

export function crmUsageSummaryFromRows(
  rows: CrmUsageMonthlySummaryRow[],
): CrmUsageByAction {
  const byAction: CrmUsageByAction = { ...EMPTY_CRM_USAGE_BY_ACTION };
  for (const row of rows) {
    const action = row.action_type;
    if (
      action === "dm" ||
      action === "sms" ||
      action === "demo_click" ||
      action === "mail"
    ) {
      byAction[action as CrmUsageAction] += row.event_count;
    }
  }
  return byAction;
}
