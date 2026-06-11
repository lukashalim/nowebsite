export const FREE_MONTHLY_OUTREACH_LIMIT = 25;

export type CrmUsageAction = "dm" | "sms" | "demo_click";

export interface CrmUsageSummary {
  used: number;
  remaining: number;
  limit: number;
  periodEnd: string;
}
