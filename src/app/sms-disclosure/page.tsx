import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import {
  COMPLIANCE_SERVICE_ATTRIBUTION,
  COMPLIANCE_US_ONLY_NOTICE,
  LEGAL_BUSINESS_ADDRESS,
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
  RING_READY_SMS_OPT_IN_URL,
  RING_READY_SMS_PROGRAM_NAME,
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
    <LegalPageShell title="SMS Messaging Disclosure">
      <LegalSection title={LEGAL_COMPANY_NAME}>
        <p>
          {COMPLIANCE_SERVICE_ATTRIBUTION} {LEGAL_COMPANY_NAME} is a business
          entity operating within the United States.
        </p>
        <p>
          <strong>Program Name:</strong> {RING_READY_SMS_PROGRAM_NAME}
        </p>
        <p>
          <strong>Description:</strong> By opting in, you agree to receive SMS
          messages from {LEGAL_COMPANY_NAME} regarding project updates, business
          notifications, and related communications.
        </p>
      </LegalSection>

      <LegalSection title="Message Frequency">
        <p>
          Message frequency varies based on project activity. You will receive
          messages only when relevant updates are available.
        </p>
      </LegalSection>

      <LegalSection title="Opt Out Instructions">
        <p>
          To stop receiving messages, reply STOP to any message you receive. You
          will be unsubscribed immediately.
        </p>
      </LegalSection>

      <LegalSection title="Help Instructions">
        <p>
          Reply HELP for assistance. For additional support, contact us at{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Rates">
        <p>
          Message and data rates may apply. Please check with your mobile carrier
          for details.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          Your mobile number and consent information will not be shared with
          third parties or affiliates for marketing or promotional purposes. See
          our{" "}
          <Link
            href="/privacy"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Privacy Policy
          </Link>{" "}
          for more details.
        </p>
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

      <LegalSection title="Contact">
        <p>
          {LEGAL_COMPANY_NAME}
          <br />
          {LEGAL_BUSINESS_ADDRESS}
          <br />
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
