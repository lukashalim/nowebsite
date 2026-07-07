import Link from "next/link";
import {
  COMPLIANCE_COPYRIGHT,
  COMPLIANCE_SERVICE_ATTRIBUTION,
  LEGAL_BUSINESS_ADDRESS,
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
} from "@/lib/legal-placeholders";

const linkClass =
  "transition-colors hover:text-zinc-900 dark:hover:text-zinc-100";

export function LegalFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-4 text-center text-sm text-zinc-500 sm:px-6 dark:text-zinc-400">
        <p>{COMPLIANCE_SERVICE_ATTRIBUTION}</p>
        <p>
          {LEGAL_COMPANY_NAME}
          <br />
          {LEGAL_BUSINESS_ADDRESS}
          <br />
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className={linkClass}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
        <nav
          aria-label="Legal links"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
        >
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
            |
          </span>
          <Link href="/terms" className={linkClass}>
            Terms and Conditions
          </Link>
          <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
            |
          </span>
          <Link href="/sms-disclosure" className={linkClass}>
            SMS Disclosure
          </Link>
          <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
            |
          </span>
          <Link href="/compliance" className={linkClass}>
            Subscribe to SMS
          </Link>
        </nav>
        <p>{COMPLIANCE_COPYRIGHT}</p>
      </div>
    </footer>
  );
}
