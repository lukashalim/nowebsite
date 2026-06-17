"use server";

import { recordOutreachUsage } from "@/app/actions/crm-usage";
import { DEMO_DETAIL_COLUMNS } from "@/lib/crm-cohort";
import { demoPathSegment, tenantDemoPublicPath } from "@/lib/demo-slug";
import { logUsageEvent } from "@/lib/log-usage-event";
import { ensureProfileUsername } from "@/lib/profile-username";
import { absoluteUrl } from "@/lib/site-url";
import { getUserProfile, getUserTwilioCredentials } from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildVoiceHandlerUrl,
  createTwilioClient,
} from "@/lib/twilio-credentials";

export type OutboundSmsResult =
  | { type: "TWILIO"; ok: true; remaining: number | null }
  | { type: "FALLBACK"; e164: string; message: string; remaining: number | null }
  | { type: "ERROR"; error: string; remaining?: number };

export type OutboundCallResult =
  | { type: "TWILIO"; ok: true; callSid: string; roomId: string }
  | { type: "FALLBACK" }
  | { type: "ERROR"; error: string };

async function requireSessionUser(userId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }
  if (user.id !== userId) {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true };
}

export async function resolveTenantDemoUrl(
  userId: string,
  placeId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await requireSessionUser(userId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const trimmedPlaceId = placeId.trim();
  if (!trimmedPlaceId) {
    return { ok: false, error: "placeId is required" };
  }

  const profile = await getUserProfile(userId);
  const username =
    profile?.username?.trim() ||
    (await ensureProfileUsername(
      userId,
      profile?.email ?? "",
    ));
  if (!username) {
    return { ok: false, error: "Set a username in Settings to generate demo links" };
  }

  const admin = createSupabaseAdmin();
  const { data: row, error } = await admin
    .from("businesses_nowebsite")
    .select(DEMO_DETAIL_COLUMNS)
    .eq("place_id", trimmedPlaceId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!row) {
    return { ok: false, error: "Business not found" };
  }

  const slug = demoPathSegment({
    place_id: String(row.place_id),
    demo_slug:
      typeof row.demo_slug === "string" ? row.demo_slug : null,
  });

  return {
    ok: true,
    url: absoluteUrl(
      tenantDemoPublicPath(username, decodeURIComponent(slug)),
    ),
  };
}

export async function sendStandardSMS(
  userId: string,
  targetPhoneNumber: string,
  messageBody: string,
  placeId: string,
): Promise<
  | { type: "FALLBACK"; e164: string; message: string; remaining: number | null }
  | { type: "ERROR"; error: string; remaining?: number }
> {
  const auth = await requireSessionUser(userId);
  if (!auth.ok) {
    return { type: "ERROR", error: auth.error };
  }

  const usage = await recordOutreachUsage("sms", placeId);
  if (!usage.ok) {
    return { type: "ERROR", error: usage.error, remaining: usage.remaining };
  }

  return {
    type: "FALLBACK",
    e164: targetPhoneNumber,
    message: messageBody,
    remaining: usage.remaining,
  };
}

export async function sendOutboundSMS(
  userId: string,
  targetPhoneNumber: string,
  messageBody: string,
  placeId: string,
): Promise<OutboundSmsResult> {
  const auth = await requireSessionUser(userId);
  if (!auth.ok) {
    return { type: "ERROR", error: auth.error };
  }

  const credentials = await getUserTwilioCredentials(userId);
  if (!credentials) {
    return sendStandardSMS(userId, targetPhoneNumber, messageBody, placeId);
  }

  const usage = await recordOutreachUsage("sms", placeId);
  if (!usage.ok) {
    return { type: "ERROR", error: usage.error, remaining: usage.remaining };
  }

  try {
    const client = createTwilioClient(credentials);
    await client.messages.create({
      from: credentials.phoneNumber,
      to: targetPhoneNumber,
      body: messageBody,
    });
    return { type: "TWILIO", ok: true, remaining: usage.remaining };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send SMS via Twilio";
    return { type: "ERROR", error: message };
  }
}

export async function initiateOutboundCall(
  userId: string,
  targetPhoneNumber: string,
  placeId?: string,
): Promise<OutboundCallResult> {
  const auth = await requireSessionUser(userId);
  if (!auth.ok) {
    return { type: "ERROR", error: auth.error };
  }

  const credentials = await getUserTwilioCredentials(userId);
  if (!credentials) {
    await logUsageEvent(userId, "phone_call_initiated", placeId);
    return { type: "FALLBACK" };
  }

  try {
    const roomId = crypto.randomUUID();
    const client = createTwilioClient(credentials);
    const call = await client.calls.create({
      to: credentials.forwardingNumber,
      from: credentials.phoneNumber,
      url: buildVoiceHandlerUrl(userId, targetPhoneNumber, roomId),
    });
    await logUsageEvent(userId, "phone_call_initiated", placeId);
    return { type: "TWILIO", ok: true, callSid: call.sid, roomId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initiate call via Twilio";
    return { type: "ERROR", error: message };
  }
}

export async function terminateCall(
  userId: string,
  callSid: string,
  roomId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSessionUser(userId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const credentials = await getUserTwilioCredentials(userId);
  if (!credentials) {
    return { ok: false, error: "Twilio credentials not configured" };
  }

  const sid = callSid.trim();
  if (!sid) {
    return { ok: false, error: "Invalid call SID" };
  }

  const client = createTwilioClient(credentials);
  const errors: string[] = [];

  const conferenceRoomId = roomId?.trim();
  if (conferenceRoomId) {
    try {
      const conferences = await client.conferences.list({
        friendlyName: conferenceRoomId,
        status: "in-progress",
        limit: 5,
      });
      await Promise.allSettled(
        conferences.map((conference) =>
          client.conferences(conference.sid).update({ status: "completed" }),
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to end Twilio conference";
      errors.push(message);
    }
  }

  try {
    await client.calls(sid).update({ status: "completed" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to terminate call via Twilio";
    errors.push(message);
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("; ") };
  }

  return { ok: true };
}

/** @deprecated Use terminateCall */
export async function terminateOutboundCall(
  userId: string,
  callSid: string,
  roomId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return terminateCall(userId, callSid, roomId);
}
