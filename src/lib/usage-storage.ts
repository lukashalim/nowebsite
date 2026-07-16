export const PROFILE_TABLE = "profiles";
export const USAGE_EVENTS_TABLE = "usage_events";

export const PROFILE_COLUMNS = {
  firstLogin: "first_login",
  lastLogin: "last_login",
  marketingOptIn: "marketing_opt_in",
} as const;

export const USAGE_EVENT_COLUMNS = {
  userId: "user_id",
  eventType: "event_type",
  leadId: "lead_id",
  createdAt: "created_at",
} as const;

export const USAGE_EVENT_TYPES = [
  "demo_site_created",
  "facebook_dm_copied",
  "sms_sent",
  "csv_page_exported",
  "user_login",
  "phone_call_initiated",
  "lead_contact_revealed",
  "postcard_sent",
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

export const OUTREACH_USAGE_EVENT_TYPES = [
  "facebook_dm_copied",
  "sms_sent",
  "demo_site_created",
  "postcard_sent",
] as const satisfies readonly UsageEventType[];

export function isUsageEventType(value: string): value is UsageEventType {
  return (USAGE_EVENT_TYPES as readonly string[]).includes(value);
}
