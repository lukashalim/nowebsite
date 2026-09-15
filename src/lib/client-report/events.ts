import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  REPORT_TIME_ZONE,
  reportPeriodStarts,
} from "@/lib/client-report/periods";

export const CLIENT_SITE_EVENTS_TABLE = "client_site_events";

export const CLIENT_SITE_EVENT_TYPES = ["page_view", "click_to_call"] as const;

export type ClientSiteEventType = (typeof CLIENT_SITE_EVENT_TYPES)[number];

export interface ClientSiteReportCounts {
  callsMonth: number;
  callsYtd: number;
  visitsMonth: number;
  visitsYtd: number;
}

export async function insertClientSiteEvent(input: {
  siteId: string;
  eventType: ClientSiteEventType;
  linkLocation?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from(CLIENT_SITE_EVENTS_TABLE).insert({
    site_id: input.siteId,
    event_type: input.eventType,
    link_location: input.linkLocation?.trim() || null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function countEvents(input: {
  siteId: string;
  eventType: ClientSiteEventType;
  sinceIso: string;
}): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { count, error } = await supabase
    .from(CLIENT_SITE_EVENTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("site_id", input.siteId)
    .eq("event_type", input.eventType)
    .gte("created_at", input.sinceIso);

  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function fetchClientSiteReportCounts(
  siteId: string,
  now = new Date(),
): Promise<ClientSiteReportCounts> {
  const { yearStart, monthStart } = reportPeriodStarts(now, REPORT_TIME_ZONE);
  const yearIso = yearStart.toISOString();
  const monthIso = monthStart.toISOString();

  const [callsMonth, callsYtd, visitsMonth, visitsYtd] = await Promise.all([
    countEvents({
      siteId,
      eventType: "click_to_call",
      sinceIso: monthIso,
    }),
    countEvents({
      siteId,
      eventType: "click_to_call",
      sinceIso: yearIso,
    }),
    countEvents({ siteId, eventType: "page_view", sinceIso: monthIso }),
    countEvents({ siteId, eventType: "page_view", sinceIso: yearIso }),
  ]);

  return { callsMonth, callsYtd, visitsMonth, visitsYtd };
}
