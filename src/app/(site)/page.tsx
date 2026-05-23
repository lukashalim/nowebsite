import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ChefHat,
  Droplets,
  Hammer,
  Scissors,
  Sparkles,
} from "lucide-react";
import { ProCta } from "@/components/pro-cta";
import { cityPath } from "@/lib/directory/labels";
import {
  fetchAllDirectoryCities,
  fetchDirectorySummary,
  fetchFeaturedCategoryLinks,
} from "@/lib/directory/data";
import { DIRECTORY_MIN_LISTINGS } from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute:
      "Find Local Businesses Without a Website | Leads for Web Designers",
  },
  description:
    "Browse city and category directories of local businesses with no website — ratings, phone numbers, and Google Maps links for web designers and agencies.",
  alternates: { canonical: absoluteUrl("/") },
};

const CATEGORY_ICONS: Record<string, typeof Building2> = {
  restaurant: ChefHat,
  painting: Hammer,
  painter: Hammer,
  plumber: Droplets,
  salon: Scissors,
  party: Sparkles,
};

function iconForCategory(label: string) {
  const key = label.toLowerCase();
  for (const [needle, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(needle)) return Icon;
  }
  return Building2;
}

export default async function HomePage() {
  let cities: Awaited<ReturnType<typeof fetchAllDirectoryCities>> = [];
  let summary: Awaited<ReturnType<typeof fetchDirectorySummary>> | null = null;
  let featuredCategories: Awaited<ReturnType<typeof fetchFeaturedCategoryLinks>> =
    [];
  let loadError: string | null = null;

  try {
    [cities, summary, featuredCategories] = await Promise.all([
      fetchAllDirectoryCities(),
      fetchDirectorySummary(),
      fetchFeaturedCategoryLinks(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load directory data.";
  }

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Find local businesses without a website — the leads list for web designers
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Public directories by city and category. Each listing includes ratings,
          review counts, phone numbers, and Google Maps links for businesses that do
          not have their own website.
        </p>
        {summary ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {summary.totalListings.toLocaleString()} businesses
            </span>{" "}
            across {summary.cityHubCount.toLocaleString()} cities
            {summary.categoryPageCount > 0 ? (
              <>
                {" "}
                · {summary.categoryPageCount.toLocaleString()} category pages (
                {DIRECTORY_MIN_LISTINGS}+ listings each)
              </>
            ) : null}
            . Open a city to see every listing there — category pages only appear
            when a city has {DIRECTORY_MIN_LISTINGS}+ businesses in the same trade.
          </p>
        ) : null}
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
                No city hubs yet (need {DIRECTORY_MIN_LISTINGS}+ listings per city).
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

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Browse by category
            </h2>
            {featuredCategories.length === 0 ? (
              <p className="text-sm text-zinc-500">No category pages yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featuredCategories.map((cat) => {
                  const Icon = iconForCategory(cat.categoryLabel);
                  return (
                    <li key={cat.categorySlug}>
                      <Link
                        href={cat.href}
                        className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                      >
                        <Icon
                          className="mt-0.5 size-5 shrink-0 text-zinc-500"
                          aria-hidden
                        />
                        <span>
                          <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                            {cat.categoryLabel}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {cat.count.toLocaleString()} nationwide · sample city
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <ProCta />
    </div>
  );
}
