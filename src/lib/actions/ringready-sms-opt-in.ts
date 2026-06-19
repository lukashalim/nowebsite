"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COMPLIANCE_SERVICE_DOMAIN,
  RING_READY_SMS_OPT_IN_CONSENT_VERSION,
} from "@/lib/legal-placeholders";
import { normalizePhoneE164 } from "@/lib/phone-lookup";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { isRingReadyHost } from "@/lib/ringready-site";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function submitRingReadySmsOptIn(formData: FormData): Promise<void> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "";
  if (!isRingReadyHost(host)) {
    redirect("/?error=invalid");
  }

  const consent = formData.get("consent");
  if (consent !== "yes") {
    redirect("/?error=invalid");
  }

  const phoneRaw = formData.get("phone");
  if (typeof phoneRaw !== "string" || !phoneRaw.trim()) {
    redirect("/?error=invalid");
  }

  const phoneE164 = normalizePhoneE164(phoneRaw, "US");
  if (!phoneE164) {
    redirect("/?error=invalid");
  }

  const ip = getClientIpFromHeaders(headerStore);
  const rateLimit = await checkRateLimit(
    "ringreadySmsOptIn",
    ip,
    headerStore.get("user-agent"),
  );
  if (!rateLimit.success) {
    redirect("/?error=rate_limit");
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("ringready_sms_opt_ins").insert({
    phone_e164: phoneE164,
    consent_version: RING_READY_SMS_OPT_IN_CONSENT_VERSION,
    source: COMPLIANCE_SERVICE_DOMAIN,
  });

  if (error && error.code !== "23505") {
    redirect("/?error=invalid");
  }

  redirect("/?subscribed=1");
}
