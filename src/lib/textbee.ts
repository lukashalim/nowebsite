import "server-only";

import { loadSharedEnvLocal } from "@/lib/load-shared-env";

const TEXTBEE_SEND_SMS_URL = "https://api.textbee.dev/api/v1/gateway/send-sms";

export function toE164Us(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendTextbeeSms(input: {
  recipients: string[];
  message: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  loadSharedEnvLocal();
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, status: 503, error: "SMS is not configured." };
  }

  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();
  const body: {
    recipients: string[];
    message: string;
    deviceId?: string;
  } = {
    recipients: input.recipients,
    message: input.message,
  };
  if (deviceId) body.deviceId = deviceId;

  let response: Response;
  try {
    response = await fetch(TEXTBEE_SEND_SMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 502, error: "Could not send the text." };
  }

  if (response.ok) return { ok: true };

  if (response.status === 429) {
    return {
      ok: false,
      status: 429,
      error: "Too many requests right now. Try again in a bit.",
    };
  }
  if (response.status === 401) {
    console.error("[textbee] API key rejected");
    return { ok: false, status: 502, error: "Could not send the text." };
  }

  console.error("[textbee] send failed", response.status);
  return { ok: false, status: 502, error: "Could not send the text." };
}
