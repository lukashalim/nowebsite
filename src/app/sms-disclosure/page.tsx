import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import {
  COMPLIANCE_SERVICE_ATTRIBUTION,
  COMPLIANCE_SMS_DISCLOSURE,
  COMPLIANCE_US_ONLY_NOTICE,
  LEGAL_COMPANY_NAME,
  RING_READY_SMS_OPT_IN_URL,
} from "@/lib/legal-placeholders";
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
        "SMS messaging disclosure for services provided by Suite300 LLC.",
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
      <LegalSection title="Operating Entity">
        <p>
          {COMPLIANCE_SERVICE_ATTRIBUTION} {LEGAL_COMPANY_NAME} is a business
          entity operating within the United States.
        </p>
      </LegalSection>

      <LegalSection title="SMS Updates">
        <p>{COMPLIANCE_SMS_DISCLOSURE}</p>
      </LegalSection>

      <LegalSection title="Opt-In and Consent">
        <p>
          Project-related SMS notifications are sent only to individuals who
          provide explicit, informed consent through the public opt-in form at{" "}
          <a
            href={RING_READY_SMS_OPT_IN_URL}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {RING_READY_SMS_OPT_IN_URL}
          </a>
          . Before submitting a mobile number, you must manually check a
          mandatory checkbox agreeing to our Terms of Service and this SMS
          Disclosure. The checkbox is unchecked by default.
        </p>
        <p>{COMPLIANCE_US_ONLY_NOTICE}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
