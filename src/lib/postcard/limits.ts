import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  USAGE_EVENT_COLUMNS,
  USAGE_EVENTS_TABLE,
  type UsageEventType,
} from "@/lib/usage-storage";

export type PostcardSendMode = "test" | "live";

const LIFETIME_LIMIT = 1;

/**
 * Lifetime 1+1 cap started with this feature. Older Lob test sends
 * (layout debugging) must not consume the allowance.
 */
const POSTCARD_LIFETIME_CAP_START = "2026-07-18T00:00:00.000Z";

function eventTypeForMode(mode: PostcardSendMode): UsageEventType {
  return mode === "test" ? "postcard_sent_test" : "postcard_sent";
}

export async function countUserPostcardSends(
  userId: string,
  mode: PostcardSendMode,
): Promise<number> {
  const admin = createSupabaseAdmin();
  const { count, error } = await admin
    .from(USAGE_EVENTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq(USAGE_EVENT_COLUMNS.userId, userId)
    .eq(USAGE_EVENT_COLUMNS.eventType, eventTypeForMode(mode))
    .gte(USAGE_EVENT_COLUMNS.createdAt, POSTCARD_LIFETIME_CAP_START);

  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function getUserPostcardLifetimeSlots(
  userId: string,
  opts?: { isPro?: boolean },
): Promise<{
  testUsed: number;
  liveUsed: number;
  /** null = unlimited (test Lob proofs never mail physically). */
  testRemaining: number | null;
  /** null = unlimited (Pro accounts). */
  liveRemaining: number | null;
}> {
  if (opts?.isPro) {
    return {
      testUsed: 0,
      liveUsed: 0,
      testRemaining: null,
      liveRemaining: null,
    };
  }

  const [testUsed, liveUsed] = await Promise.all([
    countUserPostcardSends(userId, "test"),
    countUserPostcardSends(userId, "live"),
  ]);
  return {
    testUsed,
    liveUsed,
    testRemaining: null,
    liveRemaining: Math.max(0, LIFETIME_LIMIT - liveUsed),
  };
}

export async function assertCanSendPostcard(
  userId: string,
  isTest: boolean,
  opts?: { isPro?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Pro: unlimited postcards (still needs Lob key + return address).
  if (opts?.isPro) {
    return { ok: true };
  }
  // Test Lob keys only generate proofs — no physical mail — so free users can iterate.
  if (isTest) {
    return { ok: true };
  }
  const used = await countUserPostcardSends(userId, "live");
  if (used >= LIFETIME_LIMIT) {
    return {
      ok: false,
      error: "You've already used your one live postcard.",
    };
  }
  return { ok: true };
}
