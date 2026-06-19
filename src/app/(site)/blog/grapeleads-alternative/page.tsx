import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { FREE_MONTHLY_OUTREACH_LIMIT } from "@/lib/crm-limits";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 86400;

const PAGE_PATH = "/blog/grapeleads-alternative";

export const metadata: Metadata = {
  title: {
    absolute:
      "GrapeLeads Alternative — Find Businesses Without Websites | Outreach Engine",
  },
  description:
    "GrapeLeads alternative with live no-website lead data — no broken export queues. 25 free outreach actions, in-UI Spintax DMs, and automated demo sites in one dashboard.",
  keywords: [
    "GrapeLeads alternative",
    "grapeleads alternative",
    "GrapeLeads broken",
    "grapeleads broken",
    "GrapeLeads replacement",
    "businesses without websites",
    "web design leads",
    "local business scraper",
  ],
  alternates: {
    canonical: absoluteUrl(PAGE_PATH),
  },
  openGraph: {
    title:
      "The Best GrapeLeads Alternative for Finding Businesses Without Websites",
    description:
      "Stop waiting on broken export queues. Get 25 free outreach actions with live demo pages and Spintax DMs built into one dashboard.",
    url: absoluteUrl(PAGE_PATH),
    type: "article",
  },
};

const bodyClass =
  "text-base leading-relaxed text-zinc-600 dark:text-zinc-400";
const h2Class = "text-xl font-semibold text-zinc-900 dark:text-zinc-50";

interface ComparisonRow {
  feature: string;
  ours: string;
  theirs: string;
}

const comparisonRows: ComparisonRow[] = [
  {
    feature: "Data Delivery",
    ours: "Instant. View leads immediately on your dashboard.",
    theirs: "Delayed. Relies on background queue processing.",
  },
  {
    feature: "Free Tier Access",
    ours: `${FREE_MONTHLY_OUTREACH_LIMIT} free lead actions (DMs, SMS, or Demo links).`,
    theirs: "Varies; typically paywalled immediately.",
  },
  {
    feature: "Automated Demo Sites",
    ours: "Yes. Spin up custom mockups directly from the row.",
    theirs: "No. You have to build demo sites manually.",
  },
  {
    feature: "In-UI Spintax Generator",
    ours: "Yes. Personalized Facebook/Cold DMs ready to copy.",
    theirs: "No.",
  },
  {
    feature: "Pipeline Tracking",
    ours: "Yes. Track lead status (Contacted, Bad Lead, etc.) in-app.",
    theirs: "No. Requires external CRM or spreadsheet.",
  },
  {
    feature: "Data Quality Assurance",
    ours: "Regularly filtered for no-website-only profiles.",
    theirs: "Scrapes raw maps data; high noise-to-signal ratio.",
  },
];

export default function GrapeLeadsAlternativePage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 pb-6">
      <header className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Blog
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          The Best GrapeLeads Alternative for Finding Businesses Without
          Websites
        </h1>
        <div className={`space-y-4 ${bodyClass}`}>
          <p>
            If you run a web design agency or freelance practice, prospecting
            local businesses without an online presence is one of the
            highest-ROI plays you can make. These businesses already have
            customers, revenue, and reviews on Google Maps—they just lack a
            website to capture that traffic.
          </p>
          <p>
            Tools like GrapeLeads promised to automate this pipeline. But when a
            database isn&apos;t maintained, support goes silent, or background
            export queues fail to deliver to your inbox, your prospecting
            stalls. You don&apos;t need a scraper; you need data that is live
            and actionable.
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className={h2Class}>Why Agencies are Switching</h2>
        <div className={`space-y-4 ${bodyClass}`}>
          <p>
            Legacy scrapers are built around fragile, asynchronous export loops:
            run a map scan, wait for a background job to queue, download a
            massive CSV, and manually clean out the junk. That model fails when:
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                Background Jobs Fail Silently:
              </strong>{" "}
              You queue an extract, the backend stalls, and nothing ever hits
              your inbox.
            </li>
            <li>
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                Stale, Unfiltered Data:
              </strong>{" "}
              You pay for data containing dead phone numbers or businesses that
              already built a website three months ago.
            </li>
            <li>
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                Workflow Fragmentation:
              </strong>{" "}
              Downloading a CSV means you are stuck managing your cold outreach,
              Spintax scripts, and custom demo sites across three different
              browser tabs and a messy spreadsheet.
            </li>
          </ul>
          <p>
            Outreach Engine replaces the broken scraper model with a live,
            continuously updated{" "}
            <Link
              href="/"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              directory
            </Link>{" "}
            paired with an execution dashboard. You find the lead, generate the
            pitch, and manage the pipeline in one interface.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={h2Class}>Outreach Engine vs. GrapeLeads</h2>
        <p className={bodyClass}>
          A direct comparison of what works when legacy tools break:
        </p>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">Outreach Engine</th>
                <th className="px-4 py-3 font-medium">GrapeLeads</th>
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
                  <td className="px-4 py-3 align-top text-zinc-700 dark:text-zinc-300">
                    {row.ours}
                  </td>
                  <td className="px-4 py-3 align-top text-zinc-600 dark:text-zinc-400">
                    {row.theirs}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className={h2Class}>Stop Waiting on Broken Export Queues</h2>
        <div className={`space-y-4 ${bodyClass}`}>
          <p>
            Our dashboard is built for execution, not babysitting CSVs. Sign up
            for a free account and get {FREE_MONTHLY_OUTREACH_LIMIT}{" "}
            complimentary outreach actions instantly. You can filter by review
            counts, copy AI-generated Spintax DMs, and build automated demo
            page links directly from the live data—no credit card required, and
            no broken email queues in sight.
          </p>
          <p>
            When your agency is ready to scale up volume, the Pro tier unlocks
            unlimited outreach capability on the exact same dataset you&apos;ve
            already verified.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={CRM_BASE_PATH}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Open Free Account
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/pro"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-white dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-950"
          >
            Compare Pro Features
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={h2Class}>Who This Page Is For</h2>
        <p className={bodyClass}>
          You likely landed here because you searched{" "}
          <em className="text-zinc-700 dark:text-zinc-300">
            &ldquo;GrapeLeads alternative&rdquo;
          </em>
          ,{" "}
          <em className="text-zinc-700 dark:text-zinc-300">
            &ldquo;GrapeLeads broken&rdquo;
          </em>
          , or got tired of waiting for a support email reply. Outreach Engine
          is built specifically for web designers and agencies who need reliable
          local lead data and the tools to pitch them instantly—without the
          software breaking mid-scan.
        </p>
      </section>

      <section className="space-y-3 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Related Resources
        </h2>
        <ul className={`space-y-2 ${bodyClass}`}>
          <li>
            <Link
              href="/blog/free-google-maps-data"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100"
            >
              Free Google Maps data — no scrapers, just clean CSVs
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
