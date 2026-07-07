import Link from "next/link";
import { MapPin, Send, Sparkles } from "lucide-react";
import {
  COMPLIANCE_SERVICE_ATTRIBUTION,
  LEGAL_BUSINESS_ADDRESS,
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
} from "@/lib/legal-placeholders";
import { directoryPrimaryButtonClass } from "@/lib/directory/ui-classes";
import { RING_READY_ORIGIN } from "@/lib/ringready-site";

const SIGN_IN_URL = "https://nowebsitebusinessleads.com/sign-in";

const bodyClass = "text-base leading-relaxed text-zinc-600 dark:text-zinc-400";
const h2Class = "text-xl font-semibold text-zinc-900 dark:text-zinc-50";

const linkClass =
  "font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300";

const HOW_IT_WORKS_STEPS = [
  {
    icon: MapPin,
    title: "Find a business",
    description:
      "Enter a business's Google Maps listing to generate a demo preview site.",
  },
  {
    icon: Sparkles,
    title: "Generate a preview",
    description:
      "RingReadySite builds a live demo page from their real profile data — reviews, services, hours, and photos.",
  },
  {
    icon: Send,
    title: "Send the link",
    description:
      "Share the preview URL during cold outreach so the owner sees what their site could look like.",
  },
] as const;

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: LEGAL_COMPANY_NAME,
  url: RING_READY_ORIGIN,
  email: LEGAL_CONTACT_EMAIL,
  description:
    "RingReadySite generates AI-powered demo websites from Google Maps business data for web designers and agencies doing cold outreach.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "6107 43rd Ave",
    addressLocality: "Hyattsville",
    addressRegion: "MD",
    addressCountry: "US",
  },
};

export function RingReadyHome() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-12 px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ORGANIZATION_JSON_LD),
        }}
      />

      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          RingReadySite
        </h1>
        <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
          AI-powered demo websites built from Google Maps business data — for
          web designers and agencies doing cold outreach.
        </p>
        <div className={`max-w-2xl space-y-4 ${bodyClass}`}>
          <p>
            Show local business owners a ready-made preview site built from their
            real Google Business Profile — reviews, location, services, and
            photos — before you pitch a full website build.
          </p>
          <p>
            RingReadySite turns a Maps listing into a live, shareable demo page
            in seconds so your outreach stands out from every other cold call.
          </p>
        </div>
        <a
          href={SIGN_IN_URL}
          className={`inline-flex items-center justify-center ${directoryPrimaryButtonClass} px-5 py-2.5`}
        >
          Start generating demos
        </a>
      </header>

      <section aria-labelledby="how-it-works-heading" className="space-y-4">
        <h2 id="how-it-works-heading" className={h2Class}>
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent dark:bg-amber-950/40">
                  {index + 1}
                </span>
                <step.icon
                  className="size-5 text-accent"
                  aria-hidden
                />
              </div>
              <h3 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-50">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="about-heading"
        className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        <h2 id="about-heading" className={h2Class}>
          About {LEGAL_COMPANY_NAME}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {COMPLIANCE_SERVICE_ATTRIBUTION}
        </p>
        <div className={`mt-4 space-y-4 ${bodyClass}`}>
          <p>
            {LEGAL_COMPANY_NAME} operates RingReadySite, a demo-site generator
            that creates AI-powered preview websites from Google Maps business
            data for web designers and agencies. RingReadySite is part of the No
            Website Business Leads product suite. Outreach tools live separately at{" "}
            <a
              href="https://nowebsitebusinessleads.com"
              className={linkClass}
            >
              nowebsitebusinessleads.com
            </a>
            ; ringreadysite.com is solely for generating and viewing demo preview
            sites.
          </p>
          <p>
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              {LEGAL_COMPANY_NAME}
            </strong>
            <br />
            {LEGAL_BUSINESS_ADDRESS}
            <br />
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={linkClass}>
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
        </div>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
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
      </section>

      <section aria-labelledby="sms-updates-heading" className="space-y-2">
        <h2 id="sms-updates-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          SMS updates
        </h2>
        <p className={bodyClass}>
          Sign up for SMS alerts about your demo requests — such as when a
          preview site is ready to view or when a business&apos;s listing
          information is refreshed — on our{" "}
          <Link href="/compliance" className={linkClass}>
            compliance page
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
