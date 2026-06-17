import "server-only";

import { logUsageEvent } from "@/lib/log-usage-event";
import {
  PROFILE_COLUMNS,
  PROFILE_TABLE,
} from "@/lib/usage-storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function trackUserSession(userId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdmin();
    const { data: profile, error: fetchError } = await supabase
      .from(PROFILE_TABLE)
      .select(PROFILE_COLUMNS.firstLogin)
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error(`[trackUserSession] fetch failed for ${userId}:`, fetchError.message);
      return;
    }

    if (!profile) {
      console.warn(`[trackUserSession] no profile row for ${userId}`);
      return;
    }

    const now = new Date().toISOString();
    const isFirstLogin = profile[PROFILE_COLUMNS.firstLogin] == null;

    const updatePayload = isFirstLogin
      ? {
          [PROFILE_COLUMNS.firstLogin]: now,
          [PROFILE_COLUMNS.lastLogin]: now,
          updated_at: now,
        }
      : {
          [PROFILE_COLUMNS.lastLogin]: now,
          updated_at: now,
        };

    const { error: updateError } = await supabase
      .from(PROFILE_TABLE)
      .update(updatePayload)
      .eq("id", userId);

    if (updateError) {
      console.error(`[trackUserSession] update failed for ${userId}:`, updateError.message);
      return;
    }

    const loginLog = await logUsageEvent(userId, "user_login");
    if (!loginLog.ok) {
      console.error(`[trackUserSession] login event failed for ${userId}:`, loginLog.error);
    }
  } catch (error) {
    console.error(`[trackUserSession] unexpected error for ${userId}:`, error);
  }
}
