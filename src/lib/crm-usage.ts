import {
  CRM_ACTION_TO_USAGE_EVENT,
  FREE_MONTHLY_OUTREACH_LIMIT,
  type CrmUsageAction,
  type CrmUsageSummary,
} from "@/lib/crm-limits";
import {
  crmUsageSummaryFromRows,
  fetchCrmUsageMonthlySummary,
  fetchCrmUsageMonthlyTotal,
} from "@/lib/crm-aggregate-queries";
import { logUsageEvent } from "@/lib/log-usage-event";
import { isPro, type UserProfile } from "@/lib/subscription";

function nextMonthStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString();
}

export async function getMonthlyUsageCount(userId: string): Promise<number> {
  return fetchCrmUsageMonthlyTotal(userId);
}

export async function getCrmUsageSummary(
  userId: string,
): Promise<CrmUsageSummary> {
  const rows = await fetchCrmUsageMonthlySummary(userId);
  const byAction = crmUsageSummaryFromRows(rows);
  const used =
    byAction.dm + byAction.sms + byAction.demo_click + byAction.mail;

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
  const pro = isPro(profile);

  if (!pro) {
    const used = await getMonthlyUsageCount(userId);
    if (used >= FREE_MONTHLY_OUTREACH_LIMIT) {
      return {
        ok: false,
        error: "Monthly outreach limit reached. Upgrade to Pro for unlimited DMs, SMS, demo links, and postcards.",
        remaining: 0,
      };
    }
  }

  const eventType = CRM_ACTION_TO_USAGE_EVENT[action];
  const logged = await logUsageEvent(userId, eventType, placeId);

  if (!logged.ok) {
    if (pro) {
      return { ok: false, error: logged.error, remaining: 0 };
    }
    const used = await getMonthlyUsageCount(userId);
    return {
      ok: false,
      error: logged.error,
      remaining: Math.max(0, FREE_MONTHLY_OUTREACH_LIMIT - used),
    };
  }

  if (pro) {
    return { ok: true, remaining: null };
  }

  const used = await getMonthlyUsageCount(userId);
  const remaining = FREE_MONTHLY_OUTREACH_LIMIT - used;
  return { ok: true, remaining };
}
