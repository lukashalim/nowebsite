"use server";

import type { CrmUsageAction } from "@/lib/crm-limits";
import { logUsageEvent } from "@/lib/log-usage-event";
import { recordCrmUsage } from "@/lib/crm-usage";
import { getUserProfile } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function recordOutreachUsage(
  action: CrmUsageAction,
  placeId: string,
): Promise<
  | { ok: true; remaining: number | null }
  | { ok: false; error: string; remaining: number }
> {
  if (!placeId?.trim()) {
    return { ok: false, error: "Invalid lead", remaining: 0 };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required", remaining: 0 };
  }

  const profile = await getUserProfile(user.id);
  return recordCrmUsage(user.id, profile, action, placeId);
}

export async function recordPhoneCallUsage(
  placeId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  return logUsageEvent(user.id, "phone_call_initiated", placeId);
}
