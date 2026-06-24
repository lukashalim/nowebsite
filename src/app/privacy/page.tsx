import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import {
  LEGAL_BUSINESS_ADDRESS,
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
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

  const metadata = buildRingReadyLegalPageMetadata(
    {
      title: "Privacy Policy",
      description:
        "Privacy Policy for our B2B SaaS platform providing website and outreach tools for local businesses.",
    },
    {
      isRingReady,
      canonical: isRingReady
        ? ringReadyAbsoluteUrl("/privacy")
        : absoluteUrl("/privacy"),
    },
  );

  return metadata;
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <LegalSection title="Introduction">
        <p>
          This policy governs the services provided by {LEGAL_COMPANY_NAME}{" "}
          (the operator of ringreadysite.com).
        </p>
        <p>
          {LEGAL_COMPANY_NAME} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          operates a business-to-business software platform that helps agencies
          and contractors build websites, manage leads, and communicate with
          local businesses. This Privacy Policy explains how we collect, use,
          disclose, and safeguard information when you use our website,
          applications, and related services (collectively, the
          &quot;Services&quot;).
        </p>
        <p>
          By accessing or using the Services, you agree to this Privacy Policy.
          If you do not agree, please do not use the Services.
        </p>
      </LegalSection>

      <LegalSection title="Information We Collect">
        <p>We may collect the following categories of information:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Account information:</strong> name, email address, login
            credentials, billing details, and profile settings you provide when
            registering or managing your account.
          </li>
          <li>
            <strong>Business and lead data:</strong> information about local
            businesses, including business names, addresses, phone numbers,
            public listing data, and notes you store in our CRM or demo tools.
          </li>
          <li>
            <strong>Communications data:</strong> messages sent through our
            platform, outreach templates, and records of calls or SMS sent via
            integrated providers such as Twilio.
          </li>
          <li>
            <strong>Usage data:</strong> log files, device information, IP
            address, browser type, pages viewed, and interactions with the
            Services.
          </li>
          <li>
            <strong>Payment information:</strong> processed by third-party
            payment processors (e.g., Stripe). We do not store full payment card
            numbers on our servers.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="SMS and Phone Communications">
        <p>
          If you use SMS or voice features, we and our messaging providers may
          collect and process mobile phone numbers, message content, delivery
          status, and carrier information. Messages are sent only in connection
          with your use of the Services and in compliance with applicable law,
          including A2P 10DLC and TCPA requirements.
        </p>
        <p>
          Recipients may opt out of SMS messages at any time by replying STOP.
          Reply HELP for help. Message and data rates may apply. Message
          frequency varies.
        </p>
        <p>
          We do not share, sell, or otherwise provide your mobile phone number
          or messaging consent information to any third parties or affiliates for
          marketing or promotional purposes. SMS delivery providers (such as
          Twilio) process messages solely to deliver opted-in project updates on
          our behalf.
        </p>
      </LegalSection>

      <LegalSection title="How We Use Information">
        <p>We use collected information to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Provide, maintain, and improve the Services;</li>
          <li>Authenticate users and manage subscriptions;</li>
          <li>Enable outreach, demo sites, and CRM functionality;</li>
          <li>Process payments and send transactional communications;</li>
          <li>Monitor usage, prevent fraud, and enforce our Terms of Service;</li>
          <li>Comply with legal obligations and respond to lawful requests.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Sharing of Information">
        <p>
          We do not sell personal information. We may share information with
          service providers who assist us in operating the Services (such as
          hosting, analytics, payment processing, email, and SMS delivery
          providers), when required by law, or in connection with a merger,
          acquisition, or sale of assets. We require vendors to protect
          information consistent with this policy.
        </p>
      </LegalSection>

      <LegalSection title="Data Retention">
        <p>
          We retain information for as long as your account is active or as
          needed to provide the Services, comply with legal obligations, resolve
          disputes, and enforce agreements. You may request deletion of account
          data subject to applicable retention requirements.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We implement reasonable administrative, technical, and organizational
          measures designed to protect information. No method of transmission
          over the Internet or electronic storage is completely secure, and we
          cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="Your Rights">
        <p>
          Depending on your location, you may have rights to access, correct,
          delete, or restrict processing of your personal information, or to
          object to certain processing. To exercise these rights, contact us
          using the information below.
        </p>
      </LegalSection>

      <LegalSection title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the
          revised policy on this page and update the &quot;Last updated&quot;
          date. Continued use of the Services after changes constitutes
          acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          If you have questions about this Privacy Policy or our data practices,
          contact {LEGAL_COMPANY_NAME} at:
        </p>
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
