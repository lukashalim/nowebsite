import "server-only";

import Twilio from "twilio";
import { absoluteUrl } from "@/lib/site-url";

export interface TwilioUserCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  forwardingNumber: string;
}

export function createTwilioClient(credentials: TwilioUserCredentials): Twilio.Twilio {
  return Twilio(credentials.accountSid, credentials.authToken);
}

export async function validateTwilioCredentials(
  accountSid: string,
  authToken: string,
  twilioPhoneNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sid = accountSid.trim();
  const token = authToken.trim();
  const phone = twilioPhoneNumber.trim();

  if (!sid || !token || !phone) {
    return { ok: false, error: "Account SID, auth token, and Twilio phone number are required" };
  }

  try {
    const client = Twilio(sid, token);
    await client.api.accounts(sid).fetch();

    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: phone, limit: 1 });
    if (numbers.length === 0) {
      return {
        ok: false,
        error: "Twilio phone number was not found on this account",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid Twilio credentials" };
  }
}

export function buildVoiceHandlerUrl(
  userId: string,
  targetPhoneNumber: string,
  roomId: string,
): string {
  const url = new URL(absoluteUrl("/api/twilio/voice-handler"));
  url.searchParams.set("userId", userId);
  url.searchParams.set("target", targetPhoneNumber);
  url.searchParams.set("roomId", roomId);
  return url.toString();
}

export function buildJoinConferenceUrl(userId: string, roomId: string): string {
  const url = new URL(absoluteUrl("/api/twilio/join-conference"));
  url.searchParams.set("userId", userId);
  url.searchParams.set("roomId", roomId);
  return url.toString();
}

export function validateTwilioWebhookRequest(
  authToken: string,
  signature: string,
  webhookUrl: string,
  params: Record<string, string>,
): boolean {
  return Twilio.validateRequest(authToken, signature, webhookUrl, params);
}

export function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
