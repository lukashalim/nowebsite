import type { Metadata } from "next";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { ProCta } from "@/components/pro-cta";
import { categoryGridLabel, cityPath, statePath } from "@/lib/directory/labels";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";
import {
  fetchAllDirectoryCities,
  fetchAllPublishedCategoryLinks,
  fetchDirectorySummary,
  fetchTopStates,
} from "@/lib/directory/data";
import {
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_CITY_LISTINGS,
  DIRECTORY_MIN_STATE_LISTINGS,
} from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute:
      "Local Businesses Without a Website | Free Directory for Web Designers",
  },
  description:
    "Browse our free list of local businesses without websites — restaurants, plumbers, painters and more across the US. Updated regularly. Free for web designers and agencies.",
  alternates: { canonical: absoluteUrl("/") },
};

export default async function HomePage() {
  let cities: Awaited<ReturnType<typeof fetchAllDirectoryCities>> = [];
  let summary: Awaited<ReturnType<typeof fetchDirectorySummary>> | null = null;
  let publishedCategories: Awaited<
    ReturnType<typeof fetchAllPublishedCategoryLinks>
  > = [];
  let topStates: Awaited<ReturnType<typeof fetchTopStates>> = [];
  let loadError: string | null = null;

  try {
    [cities, summary, publishedCategories, topStates] = await Promise.all([
      fetchAllDirectoryCities(),
      fetchDirectorySummary(),
      fetchAllPublishedCategoryLinks(),
      fetchTopStates(8),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load directory data.";
  }

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Local Businesses Without a Website
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          A free directory of small businesses without websites across the US — Google
          businesses without a website, sourced directly from Google Maps. Browse by
          city, state, or category; each listing includes ratings, review counts, phone
          numbers, and Google Maps links. Every listing is a real Google business
          profile verified to have no website. Updated regularly.
        </p>
      </section>

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Categories
              </h2>
              {publishedCategories.length > 0 ? (
                <Link
                  href="/categories"
                  className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  View all {publishedCategories.length} categories
                </Link>
              ) : null}
            </div>
            {publishedCategories.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No category pages yet (need {DIRECTORY_MIN_CATEGORY_LISTINGS}+
                listings per category nationwide).
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {publishedCategories.map((cat) => (
                  <li key={cat.categorySlug}>
                    <Link
                      href={cat.href}
                      className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <CategoryIcon
                        categoryLabel={cat.categoryLabel}
                        className="mt-0.5 size-5 shrink-0 text-zinc-500"
                      />
                      <span>
                        <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                          {categoryGridLabel(cat.categoryLabel)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {cat.count.toLocaleString()} nationwide
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Browse by state
              </h2>
            </div>
            {topStates.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No state pages yet (need {DIRECTORY_MIN_STATE_LISTINGS}+ listings per
                state).
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {topStates.map((s) => (
                  <li key={s.stateSlug}>
                    <Link
                      href={statePath(s.stateSlug)}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {stateAbbrToDisplayName(stateToAbbr(s.state) ?? s.state)}
                      </span>
                      <span className="tabular-nums text-zinc-500">
                        {s.listingCount.toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Cities
              </h2>
              {cities.length > 0 ? (
                <Link
                  href="/cities"
                  className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  View all {cities.length} cities
                </Link>
              ) : null}
            </div>
            {cities.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No city hubs yet (need {DIRECTORY_MIN_CITY_LISTINGS}+ listings per
                city).
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cities.map((c) => (
                  <li key={c.citySlug}>
                    <Link
                      href={cityPath(c.citySlug)}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {c.city}, {c.state}
                      </span>
                      <span className="tabular-nums text-zinc-500">
                        {c.listingCount.toLocaleString()} listings
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {summary ? (
            <section
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/40"
              aria-label="Directory coverage"
            >
              <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                {summary.totalListings.toLocaleString()} businesses listed
              </p>
              <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
                across {summary.cityHubCount.toLocaleString()} cities,{" "}
                {summary.statePageCount.toLocaleString()} states, and{" "}
                {summary.categoryPageCount.toLocaleString()} categories — no website,
                ready for outreach
              </p>
              <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
                Looking for local businesses without websites near you? Browse by city
                or state below.
              </p>
            </section>
          ) : null}
        </>
      )}

      <ProCta />
    </div>
  );
}
