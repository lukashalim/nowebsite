import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";
import { COMPLIANCE_SMS_DISCLOSURE } from "@/lib/legal-placeholders";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "SMS Disclosure",
  description:
    "SMS messaging disclosure for services provided by Saavy Data Science.",
  alternates: { canonical: absoluteUrl("/sms-disclosure") },
};

export default function SmsDisclosurePage() {
  return (
    <LegalPageShell title="SMS Disclosure">
      <LegalSection title="SMS Updates">
        <p>{COMPLIANCE_SMS_DISCLOSURE}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
