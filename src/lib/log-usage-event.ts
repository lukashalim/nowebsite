import "server-only";

import {
  isUsageEventType,
  USAGE_EVENT_COLUMNS,
  USAGE_EVENTS_TABLE,
  type UsageEventType,
} from "@/lib/usage-storage";
import { LIVE_POSTCARD_ALREADY_SENT_TODAY } from "@/lib/postcard/limits";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function logUsageEvent(
  userId: string,
  eventType: UsageEventType,
  leadId?: string,
): Promise<
  | { ok: true; eventId: number | null }
  | { ok: false; error: string; uniqueViolation?: boolean }
> {
  if (!isUsageEventType(eventType)) {
    return { ok: false, error: `Invalid event type: ${eventType}` };
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from(USAGE_EVENTS_TABLE)
    .insert({
      [USAGE_EVENT_COLUMNS.userId]: userId,
      [USAGE_EVENT_COLUMNS.eventType]: eventType,
      [USAGE_EVENT_COLUMNS.leadId]: leadId?.trim() || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error) && eventType === "postcard_sent") {
      return {
        ok: false,
        error: LIVE_POSTCARD_ALREADY_SENT_TODAY,
        uniqueViolation: true,
      };
    }
    return { ok: false, error: error.message };
  }

  const eventId =
    data && typeof data.id === "number"
      ? data.id
      : data && typeof data.id === "string" && /^\d+$/.test(data.id)
        ? Number(data.id)
        : null;

  return { ok: true, eventId };
}

export async function deleteUsageEventById(
  eventId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from(USAGE_EVENTS_TABLE)
    .delete()
    .eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
