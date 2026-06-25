"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COMPLIANCE_SERVICE_DOMAIN,
  RING_READY_COMPLIANCE_CONSENT_VERSION,
} from "@/lib/legal-placeholders";
import { processRingReadySmsOptIn } from "@/lib/ringready-sms-opt-in-core";
import { getClientIpFromHeaders } from "@/lib/rate-limit";
import { isRingReadyHost } from "@/lib/ringready-site";

export async function submitRingReadySmsOptIn(formData: FormData): Promise<void> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "";
  if (!isRingReadyHost(host)) {
    redirect("/?error=invalid");
  }

  const phone = formData.get("phone");
  const consent = formData.get("consent");

  const result = await processRingReadySmsOptIn({
    phoneRaw: typeof phone === "string" ? phone : "",
    consent: typeof consent === "string" ? consent : null,
    ip: getClientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
    source: COMPLIANCE_SERVICE_DOMAIN,
    consentVersion: RING_READY_COMPLIANCE_CONSENT_VERSION,
  });

  if (!result.ok) {
    redirect(`/?error=${result.reason === "rate_limit" ? "rate_limit" : "invalid"}`);
  }

  redirect("/?subscribed=1");
}
