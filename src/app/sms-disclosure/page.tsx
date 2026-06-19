import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { COMPLIANCE_SMS_DISCLOSURE } from "@/lib/legal-placeholders";
import {
  buildRingReadyLegalPageMetadata,
  isRingReadyHost,
  ringReadyAbsoluteUrl,
} from "@/lib/ringready-site";
import { absoluteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  const isRingReady = isRingReadyHost(host);

  return buildRingReadyLegalPageMetadata(
    {
      title: "SMS Disclosure",
      description:
        "SMS messaging disclosure for services provided by Saavy Data Science.",
    },
    {
      isRingReady,
      canonical: isRingReady
        ? ringReadyAbsoluteUrl("/sms-disclosure")
        : absoluteUrl("/sms-disclosure"),
    },
  );
}

export default function SmsDisclosurePage() {
  return (
    <LegalPageShell title="SMS Disclosure">
      <LegalSection title="SMS Updates">
        <p>{COMPLIANCE_SMS_DISCLOSURE}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
