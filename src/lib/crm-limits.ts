export const FREE_MONTHLY_OUTREACH_LIMIT = 25;

export type CrmUsageAction = "dm" | "sms" | "demo_click";

export interface CrmUsageByAction {
  dm: number;
  sms: number;
  demo_click: number;
}

export interface CrmUsageSummary {
  used: number;
  remaining: number;
  limit: number;
  periodEnd: string;
  byAction: CrmUsageByAction;
}

export const CRM_USAGE_ACTION_LABELS: Record<CrmUsageAction, string> = {
  dm: "DMs",
  sms: "SMS",
  demo_click: "demo links",
};

export const EMPTY_CRM_USAGE_BY_ACTION: CrmUsageByAction = {
  dm: 0,
  sms: 0,
  demo_click: 0,
};
