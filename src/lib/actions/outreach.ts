"use server";

import { recordOutreachUsage } from "@/app/actions/crm-usage";
import { getUserTwilioCredentials } from "@/lib/subscription";
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
  | { type: "TWILIO"; ok: true }
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
): Promise<OutboundCallResult> {
  const auth = await requireSessionUser(userId);
  if (!auth.ok) {
    return { type: "ERROR", error: auth.error };
  }

  const credentials = await getUserTwilioCredentials(userId);
  if (!credentials) {
    return { type: "FALLBACK" };
  }

  try {
    const client = createTwilioClient(credentials);
    await client.calls.create({
      to: credentials.forwardingNumber,
      from: credentials.phoneNumber,
      url: buildVoiceHandlerUrl(userId, targetPhoneNumber),
    });
    return { type: "TWILIO", ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initiate call via Twilio";
    return { type: "ERROR", error: message };
  }
}
