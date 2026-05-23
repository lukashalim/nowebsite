import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: {
    absolute: "How to Turn No-Website Businesses Into Web Design Clients",
  },
  description:
    "A step-by-step guide for web designers on finding, reaching out to, and closing businesses without websites as clients.",
  alternates: { canonical: absoluteUrl("/how-it-works") },
};

const bodyClass =
  "text-base leading-relaxed text-zinc-600 dark:text-zinc-400";
const h2Class = "text-xl font-semibold text-zinc-900 dark:text-zinc-50";

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10 pb-4">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          How to Turn No-Website Businesses Into Web Design Clients
        </h1>
        <div className={`space-y-4 ${bodyClass}`}>
          <p>
            Finding a business without a website is the easy part. Converting them
            into a paying client is where most web designers get stuck. Here&apos;s a
            proven approach that works.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className={h2Class}>Why these leads are warm, not cold</h2>
        <div className={`space-y-4 ${bodyClass}`}>
          <p>
            A business without a website isn&apos;t unaware of the internet —
            they&apos;re just behind. They&apos;ve claimed their Google Maps listing,
            they have real customers, real reviews, and they&apos;re actively
            operating. They&apos;re not anti-technology. They just haven&apos;t
            prioritized a website yet.
          </p>
          <p>
            That&apos;s a very different conversation from cold outreach to a random
            business. You&apos;re not convincing them they need to exist online —
            they already do. You&apos;re just filling an obvious gap.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={h2Class}>Step 1: Find the right businesses</h2>
        <p className={bodyClass}>
          Not all no-website businesses are equal. Focus on ones with:
        </p>
        <ul className={`list-disc space-y-2 pl-5 ${bodyClass}`}>
          <li>
            10+ reviews — proves they have real customers and cash flow
          </li>
          <li>
            4+ star rating — they&apos;re good at what they do, just not online
          </li>
          <li>
            Active Google Maps listing — they care about their online presence
          </li>
        </ul>
        <p className={bodyClass}>
          This directory filters for exactly that. Every listing is sorted by
          review count so the best prospects are at the top.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/60 sm:p-6">
        <h2 className={h2Class}>Step 2: Lead with a demo page</h2>
        <div className={`mt-3 space-y-4 ${bodyClass}`}>
          <p>Don&apos;t open with a pitch. Open with a gift.</p>
          <p>
            Build a quick demo page showing what their website could look like —
            their business name, location, services, reviews pulled from Google Maps.
            Send it to them before you even get on a call.
          </p>
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm italic text-zinc-700 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
            &ldquo;Hey, I&apos;m a local web designer. I put together a quick demo
            of what your website could look like — no cost, no obligation. Take a
            look and let me know what you think.&rdquo;
          </p>
          <p>
            This one move separates you from every other web designer cold calling
            them. They can see the result before they spend a dime.
          </p>
          <p>
            Our Pro plan includes an instant demo page builder — generate a
            professional demo for any business in seconds.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={h2Class}>Step 3: Reach out where they are</h2>
        <ul className={`list-disc space-y-3 pl-5 ${bodyClass}`}>
          <li>
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              Phone
            </strong>{" "}
            — still the highest conversion channel for local businesses. Keep it
            short: &ldquo;I build websites for [niche] businesses in [city]. I
            noticed you don&apos;t have one yet — I put together a quick demo for
            you, mind if I send it over?&rdquo;
          </li>
          <li>
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              Facebook
            </strong>{" "}
            — most local business owners are active. A friendly message with a demo
            link gets opened
          </li>
          <li>
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              Email
            </strong>{" "}
            — slower but scalable. Personalize with their business name and review
            count
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={h2Class}>Step 4: Handle the objections</h2>
        <ul className={`space-y-4 ${bodyClass}`}>
          <li>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              &ldquo;We don&apos;t need a website, we get customers from word of
              mouth&rdquo;
            </p>
            <p className="mt-1">
              → &ldquo;That&apos;s great — a website would let those word-of-mouth
              customers send others directly to you instead of hoping they remember
              your name.&rdquo;
            </p>
          </li>
          <li>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              &ldquo;We can&apos;t afford it right now&rdquo;
            </p>
            <p className="mt-1">
              → Start with a simple one-page site at a lower price point. Get your
              foot in the door.
            </p>
          </li>
          <li>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              &ldquo;We already have Facebook&rdquo;
            </p>
            <p className="mt-1">
              → &ldquo;Facebook is rented land — they can change the algorithm or
              shut your page down anytime. A website is yours.&rdquo;
            </p>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={h2Class}>Step 5: Close with social proof</h2>
        <p className={bodyClass}>
          Show them a before/after from a similar business you&apos;ve helped. If
          you&apos;re just starting out, offer the first client a discounted rate in
          exchange for a testimonial.
        </p>
      </section>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-8 sm:flex-row sm:flex-wrap dark:border-zinc-800">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Browse the Directory
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          href="/pro"
          className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Get Pro Access
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
