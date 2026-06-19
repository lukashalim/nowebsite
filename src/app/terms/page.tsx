import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import {
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
} from "@/lib/legal-placeholders";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for our B2B SaaS platform providing website and outreach tools for local businesses.",
  alternates: { canonical: absoluteUrl("/terms") },
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service">
      <LegalSection title="Agreement to Terms">
        <p>
          This agreement governs the services provided by Saavy Data Science
          (the operator of ringreadysite.com).
        </p>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of the websites, applications, and services provided by{" "}
          {LEGAL_COMPANY_NAME} (&quot;Company,&quot; &quot;we,&quot;
          &quot;us,&quot; or &quot;our&quot;). Our Services help agencies and
          contractors create websites, manage leads, and communicate with local
          businesses.
        </p>
        <p>
          By creating an account or using the Services, you agree to these
          Terms and our Privacy Policy. If you are using the Services on behalf
          of an organization, you represent that you have authority to bind that
          organization.
        </p>
      </LegalSection>

      <LegalSection title="Eligibility and Accounts">
        <p>
          You must be at least 18 years old and capable of forming a binding
          contract to use the Services. You are responsible for maintaining the
          confidentiality of your account credentials and for all activity under
          your account. Notify us promptly of any unauthorized use.
        </p>
      </LegalSection>

      <LegalSection title="Subscriptions and Payments">
        <p>
          Paid features may require a subscription or one-time payment. Fees,
          billing cycles, and renewal terms are disclosed at checkout or in your
          account. Payments are processed by third-party providers. Except where
          required by law, fees are non-refundable. We may change pricing with
          reasonable notice.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Use the Services for unlawful, fraudulent, or harmful purposes;</li>
          <li>
            Send unsolicited or non-compliant SMS, calls, or emails in violation
            of TCPA, CAN-SPAM, A2P 10DLC, or similar regulations;
          </li>
          <li>
            Impersonate others, misrepresent your identity, or use the Services
            to harass or spam recipients;
          </li>
          <li>
            Scrape, reverse engineer, or attempt to gain unauthorized access to
            the Services or related systems;
          </li>
          <li>
            Upload malware or content that infringes intellectual property or
            privacy rights of others.
          </li>
        </ul>
        <p>
          You are solely responsible for obtaining any consent required before
          contacting individuals through the Services and for the content of
          messages you send.
        </p>
      </LegalSection>

      <LegalSection title="SMS and Messaging Compliance">
        <p>
          If you use SMS or messaging features, you agree to comply with all
          applicable carrier and regulatory requirements, including registering
          campaigns where required, honoring opt-out requests (including STOP
          replies), and including required disclosures in your messages. We may
          suspend messaging features if we reasonably believe your use violates
          law or carrier policies.
        </p>
      </LegalSection>

      <LegalSection title="Customer Content and Demo Sites">
        <p>
          You retain ownership of content you submit to the Services. You grant
          us a limited license to host, display, and process that content as
          needed to operate the Services, including generating demo websites and
          outreach materials for your clients. You represent that you have the
          rights necessary to use and share such content.
        </p>
        <p>
          Demo sites and preview pages are provided for sales and marketing
          purposes. They may display publicly available business information and
          are not affiliated with the businesses shown unless explicitly stated.
        </p>
      </LegalSection>

      <LegalSection title="Intellectual Property">
        <p>
          The Services, including software, design, and branding, are owned by
          the Company or its licensors and are protected by intellectual
          property laws. Except for the limited rights expressly granted, no
          license is transferred to you.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of Warranties">
        <p>
          THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
          IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE
          UNINTERRUPTED, ERROR-FREE, OR THAT LEAD OR LISTING DATA IS COMPLETE OR
          ACCURATE.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY SHALL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING
          FROM YOUR USE OF THE SERVICES. OUR TOTAL LIABILITY FOR ANY CLAIM
          RELATING TO THE SERVICES SHALL NOT EXCEED THE AMOUNT YOU PAID US IN
          THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          You may stop using the Services at any time. We may suspend or
          terminate access if you violate these Terms or if required for legal
          or security reasons. Provisions that by their nature should survive
          termination will remain in effect.
        </p>
      </LegalSection>

      <LegalSection title="Changes to Terms">
        <p>
          We may modify these Terms from time to time. Material changes will be
          posted on this page with an updated date. Continued use after changes
          constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="Governing Law">
        <p>
          These Terms are governed by the laws of the jurisdiction in which the
          Company is established, without regard to conflict-of-law principles.
          Disputes shall be resolved in the courts of that jurisdiction, unless
          otherwise required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms may be sent to{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
