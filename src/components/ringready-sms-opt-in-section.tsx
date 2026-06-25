import Link from "next/link";
import { submitRingReadySmsOptIn } from "@/lib/actions/ringready-sms-opt-in";
import {
  RING_READY_COMPLIANCE_CHECKBOX_TEXT,
  RING_READY_COMPLIANCE_DISCLOSURE,
} from "@/lib/legal-placeholders";

const linkClass =
  "font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300";

interface RingReadySmsOptInSectionProps {
  subscribed?: string;
  error?: string;
}

export function RingReadySmsOptInSection({
  subscribed,
  error,
}: RingReadySmsOptInSectionProps) {
  const showSuccess = subscribed === "1";
  const showError = Boolean(error);

  return (
    <section
      id="sms-optin"
      aria-labelledby="sms-updates-heading"
      className="mx-auto mt-8 w-full max-w-md scroll-mt-8 space-y-4 text-left"
    >
      <h2 id="sms-updates-heading" className="sr-only">
        SMS opt-in
      </h2>

      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {RING_READY_COMPLIANCE_DISCLOSURE}
      </p>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/privacy" className={linkClass}>
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms" className={linkClass}>
          Terms of Service
        </Link>
        {" · "}
        <Link href="/sms-disclosure" className={linkClass}>
          SMS Disclosure
        </Link>
      </p>

      {showSuccess ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          Thank you. You are signed up for SMS updates.
        </p>
      ) : null}

      {showError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error === "rate_limit"
            ? "Too many attempts. Please try again later."
            : "Please enter a valid mobile number and agree to the terms to continue."}
        </p>
      ) : null}

      {!showSuccess ? (
        <form
          id="sms-optin-form"
          action={submitRingReadySmsOptIn}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label
              htmlFor="ringready-phone"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Mobile phone number
            </label>
            <input
              id="ringready-phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="(555) 555-5555"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="ringready-consent"
              name="consent"
              type="checkbox"
              value="yes"
              required
              className="mt-1 size-4 shrink-0 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
            />
            <label
              htmlFor="ringready-consent"
              className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
            >
              {RING_READY_COMPLIANCE_CHECKBOX_TEXT}{" "}
              <Link href="/privacy" className={linkClass}>
                Privacy Policy
              </Link>{" "}
              <Link href="/terms" className={linkClass}>
                Terms of Service
              </Link>
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get SMS Updates
          </button>
        </form>
      ) : null}
    </section>
  );
}
