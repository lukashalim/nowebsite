import "server-only";

import {
  isUsageEventType,
  USAGE_EVENT_COLUMNS,
  USAGE_EVENTS_TABLE,
  type UsageEventType,
} from "@/lib/usage-storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function logUsageEvent(
  userId: string,
  eventType: UsageEventType,
  leadId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUsageEventType(eventType)) {
    return { ok: false, error: `Invalid event type: ${eventType}` };
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from(USAGE_EVENTS_TABLE).insert({
    [USAGE_EVENT_COLUMNS.userId]: userId,
    [USAGE_EVENT_COLUMNS.eventType]: eventType,
    [USAGE_EVENT_COLUMNS.leadId]: leadId?.trim() || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
