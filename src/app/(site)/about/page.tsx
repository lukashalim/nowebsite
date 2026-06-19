import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "About | No Website Business Leads",
  description:
    "B2B prospecting platform and export-ready lead lists for web designers and agencies targeting local businesses without standalone websites.",
  alternates: { canonical: absoluteUrl("/about") },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          About No Website Business Leads
        </h1>
        <div className="space-y-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            We built this directory for one reason: finding businesses without
            websites is tedious, and web designers shouldn&apos;t have to do it
            manually.
          </p>
          <p>
            Every listing on this site is a real, active business pulled from
            Google Maps — verified to have no website, sorted by review count so
            the best prospects rise to the top. Data is scraped regularly so the
            leads stay fresh.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Who this is for
        </h2>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Web designers and agencies who want a steady pipeline of warm prospects.
          These aren&apos;t cold leads — they&apos;re established businesses with
          real customers, real reviews, and a clear gap you can fill.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          How it works
        </h2>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          We scrape Google Maps by city and category, filter out any business with
          an existing web presence, and publish the results as a free public
          directory. Every listing includes the business name, rating, review
          count, phone number, and a direct Google Maps link.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pro tools
        </h2>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          The free directory is just the start. Pro access includes contact stage
          tracking, DM outreach templates, and an instant demo page builder — so
          you can show a prospect their future website before you even get on a
          call.
        </p>
      </section>
      <section className="space-y-3 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Browse the data
        </h2>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Explore verified no-website businesses by{" "}
          <Link href="/cities" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100">
            city
          </Link>
          ,{" "}
          <Link href="/states" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100">
            state
          </Link>
          , or{" "}
          <Link href="/categories" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100">
            category
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
