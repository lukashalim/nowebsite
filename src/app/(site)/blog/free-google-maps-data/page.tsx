import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { FREE_DIRECTORY_CSV_MAX_PAGES } from "@/lib/directory-csv-limits";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 86400;

const PAGE_PATH = "/blog/free-google-maps-data";

export const metadata: Metadata = {
  title: {
    absolute:
      "Free Google Maps Data — No Scrapers, No Proxies | No-Website Leads",
  },
  description:
    "Skip Google Maps scraper setup, proxies, and broken exports. Browse pre-filtered no-website business leads and download clean CSVs free — no credit card required.",
  keywords: [
    "free google maps data",
    "google maps scraper free",
    "google maps leads csv",
    "extract google maps data",
    "local business leads",
    "google maps data export",
    "no website businesses",
    "web design leads",
  ],
  alternates: {
    canonical: absoluteUrl(PAGE_PATH),
  },
  openGraph: {
    title: "Free Google Maps Data: No Scrapers, No Proxies, Just Clean CSVs",
    description:
      "Pre-filtered Google Maps leads for agencies. Browse live, export page CSVs free, and pitch with built-in Spintax and demo tools.",
    url: absoluteUrl(PAGE_PATH),
    type: "article",
  },
};

const bodyClass =
  "text-base leading-relaxed text-zinc-600 dark:text-zinc-400";
const h2Class = "text-xl font-semibold text-zinc-900 dark:text-zinc-50";

interface ComparisonRow {
  feature: string;
  scrapers: string;
  ours: string;
}

const comparisonRows: ComparisonRow[] = [
  {
    feature: "Setup",
    scrapers: "Requires extension or API setup",
    ours: "Zero setup. Browse live inside your dashboard.",
  },
  {
    feature: "Data quality",
    scrapers: "Pays for raw data (including junk listings)",
    ours: "Pre-filtered. Only high-intent leads without websites.",
  },
  {
    feature: "Reliability",
    scrapers: "Fragile browser sessions that crash mid-scan",
    ours: "Instant CSV generation. Click to export.",
  },
  {
    feature: "Workflow",
    scrapers: "Requires external CRM to manage outreach",
    ours: "Built-in workspace. Track your outreach stages in-app.",
  },
];

export default function FreeGoogleMapsDataPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 pb-6">
      <header className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Blog
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Free Google Maps Data: No Scrapers, No Proxies, Just Clean CSVs
        </h1>
        <div className={`space-y-4 ${bodyClass}`}>
          <p>
            If you are trying to extract local business leads from Google Maps,
            running a raw scraper extension or GitHub script is a massive
            bottleneck. You have to configure API keys, rent proxies to avoid
            getting blocked, wait hours for map scans to finish, and then
            manually clean out duplicate rows.
          </p>
          <p>
            No-Website Leads does the heavy lifting for you. We continuously
            crawl, clean, and verify Google Maps data, packaging it into
            instant, downloadable lists—completely free.
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className={h2Class}>
          Skip the Scraper Setup. Download Your Data Instantly.
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">Traditional G Maps Scrapers</th>
                <th className="px-4 py-3 font-medium">No-Website Leads</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 align-top font-medium text-zinc-800 dark:text-zinc-200">
                    {row.feature}
                  </td>
                  <td className="px-4 py-3 align-top text-zinc-600 dark:text-zinc-400">
                    {row.scrapers}
                  </td>
                  <td className="px-4 py-3 align-top text-zinc-700 dark:text-zinc-300">
                    {row.ours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={h2Class}>Clean Data Formatted for Agencies</h2>
        <div className={`space-y-4 ${bodyClass}`}>
          <p>
            We don&apos;t just dump raw JSON records. Our free public directory
            and dashboard isolate the exact sub-niche with the highest conversion
            rate for freelancers and web design agencies: verified businesses
            with active Google reviews who completely lack an online presence.
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                Export Page CSVs for Free:
              </strong>{" "}
              Grab your local targets instantly without entering a credit card.
              Free exports include up to {FREE_DIRECTORY_CSV_MAX_PAGES} listing
              pages per download.
            </li>
            <li>
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                Verify Data Quality Live:
              </strong>{" "}
              See business names, review counts, and location parameters right
              inside the UI before you download.
            </li>
            <li>
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                Execute Immediately:
              </strong>{" "}
              Use our built-in Spintax Facebook DM templates and automated demo
              site tools to pitch the leads you just found.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Access by Category
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/cities"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-white dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-950"
          >
            Access by City
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <p className={`text-sm ${bodyClass}`}>
          Need outreach tools after you export?{" "}
          <Link
            href={CRM_BASE_PATH}
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
          >
            Open the free CRM workspace
          </Link>{" "}
          to track contact stages, copy Spintax DMs, and generate demo links.
        </p>
      </section>

      <section className="space-y-3 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Related Resources
        </h2>
        <ul className={`space-y-2 ${bodyClass}`}>
          <li>
            <Link
              href="/blog/grapeleads-alternative"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              GrapeLeads alternative for no-website lead prospecting
            </Link>
          </li>
          <li>
            <Link
              href="/categories"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              Browse leads by category
            </Link>
          </li>
          <li>
            <Link
              href="/cities"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              Browse leads by city
            </Link>
          </li>
          <li>
            <Link
              href="/states"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              Browse leads by state
            </Link>
          </li>
          <li>
            <Link
              href="/united-kingdom"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              United Kingdom lead lists
            </Link>
          </li>
          <li>
            <Link
              href="/facebook"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              Facebook-as-website leads
            </Link>
          </li>
        </ul>
        <p className="pt-2 text-sm text-zinc-500 dark:text-zinc-500">
          Directory data last updated: June 2026
        </p>
      </section>
    </article>
  );
}
