import {
  EMPTY_CRM_USAGE_BY_ACTION,
  FREE_MONTHLY_OUTREACH_LIMIT,
  type CrmUsageAction,
  type CrmUsageByAction,
  type CrmUsageSummary,
} from "@/lib/crm-limits";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isPro, type UserProfile } from "@/lib/subscription";

function currentMonthStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function nextMonthStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString();
}

function countUsageByAction(
  rows: { action_type: string }[],
): CrmUsageByAction {
  const byAction: CrmUsageByAction = { ...EMPTY_CRM_USAGE_BY_ACTION };

  for (const row of rows) {
    const action = row.action_type;
    if (action === "dm" || action === "sms" || action === "demo_click") {
      byAction[action] += 1;
    }
  }

  return byAction;
}

async function fetchMonthlyUsageEvents(
  userId: string,
): Promise<{ action_type: string }[]> {
  const supabase = createSupabaseAdmin();
  const monthStart = currentMonthStartUtc();

  const { data, error } = await supabase
    .from("crm_usage_events")
    .select("action_type")
    .eq("user_id", userId)
    .gte("created_at", monthStart);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getMonthlyUsageCount(userId: string): Promise<number> {
  const rows = await fetchMonthlyUsageEvents(userId);
  return rows.length;
}

export async function getCrmUsageSummary(
  userId: string,
): Promise<CrmUsageSummary> {
  const rows = await fetchMonthlyUsageEvents(userId);
  const byAction = countUsageByAction(rows);
  const used = byAction.dm + byAction.sms + byAction.demo_click;

  return {
    used,
    remaining: Math.max(0, FREE_MONTHLY_OUTREACH_LIMIT - used),
    limit: FREE_MONTHLY_OUTREACH_LIMIT,
    periodEnd: nextMonthStartUtc(),
    byAction,
  };
}

export function canUseCrmOutreach(
  profile: UserProfile | null | undefined,
  remaining: number,
): boolean {
  return isPro(profile) || remaining > 0;
}

export async function recordCrmUsage(
  userId: string,
  profile: UserProfile | null | undefined,
  action: CrmUsageAction,
  placeId?: string,
): Promise<
  | { ok: true; remaining: number | null }
  | { ok: false; error: string; remaining: number }
> {
  if (isPro(profile)) {
    return { ok: true, remaining: null };
  }

  const used = await getMonthlyUsageCount(userId);
  if (used >= FREE_MONTHLY_OUTREACH_LIMIT) {
    return {
      ok: false,
      error: "Monthly outreach limit reached. Upgrade to Pro for unlimited DMs, SMS, and demo links.",
      remaining: 0,
    };
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("crm_usage_events").insert({
    user_id: userId,
    action_type: action,
    place_id: placeId?.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
      remaining: Math.max(0, FREE_MONTHLY_OUTREACH_LIMIT - used),
    };
  }

  const remaining = FREE_MONTHLY_OUTREACH_LIMIT - used - 1;
  return { ok: true, remaining };
}
