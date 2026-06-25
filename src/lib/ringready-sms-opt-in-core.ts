import { normalizePhoneE164 } from "@/lib/phone-lookup";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface RingReadySmsOptInInput {
  phoneRaw: string;
  consent: string | null;
  ip: string;
  userAgent: string | null;
  source: string;
  consentVersion: string;
}

export type RingReadySmsOptInResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "rate_limit" };

export async function processRingReadySmsOptIn(
  input: RingReadySmsOptInInput,
): Promise<RingReadySmsOptInResult> {
  if (input.consent !== "yes") {
    return { ok: false, reason: "invalid" };
  }

  if (!input.phoneRaw.trim()) {
    return { ok: false, reason: "invalid" };
  }

  const phoneE164 = normalizePhoneE164(input.phoneRaw, "US");
  if (!phoneE164) {
    return { ok: false, reason: "invalid" };
  }

  const rateLimit = await checkRateLimit(
    "ringreadySmsOptIn",
    input.ip,
    input.userAgent,
  );
  if (!rateLimit.success) {
    return { ok: false, reason: "rate_limit" };
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("ringready_sms_opt_ins").insert({
    phone_e164: phoneE164,
    consent_version: input.consentVersion,
    source: input.source,
  });

  if (error && error.code !== "23505") {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}
