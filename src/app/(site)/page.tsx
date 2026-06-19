import type { Metadata } from "next";
import Link from "next/link";
import { LayoutTemplate, Search, Workflow } from "lucide-react";
import { CategoryGroupIcon } from "@/components/category-group-icon";
import { CategoryIcon } from "@/components/category-icon";
import { categoryGridLabel, cityPath, statePath } from "@/lib/directory/labels";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";
import {
  fetchAllDirectoryCities,
  fetchAllPublishedCategoryLinks,
  fetchDirectoryLastUpdatedLabel,
  fetchDirectorySummary,
  fetchFacebookDirectoryListingTotal,
  fetchTopStates,
  fetchUkListingCount,
} from "@/lib/directory/data";
import {
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_CITY_LISTINGS,
  DIRECTORY_MIN_STATE_LISTINGS,
} from "@/lib/directory/types";
import { fetchCategoryGroupTaxonomy, fallbackCategoryGroupTaxonomy } from "@/lib/directory/category-groups";
import { absoluteUrl } from "@/lib/site-url";
import {
  directoryCardLinkClass,
  directoryOutlineButtonClass,
} from "@/lib/directory/ui-classes";

const SIGN_IN_PATH = "/sign-in";

const RING_READY_SITE_URL = "https://ringreadysite.com";

const HOME_FEATURES = [
  {
    icon: Search,
    title: "Find Leads",
    highlighted: false,
    description: (listingCount: number | null) =>
      listingCount !== null
        ? `Browse ${listingCount.toLocaleString()} verified no-website businesses by city, state, and category`
        : "Browse verified no-website businesses by city, state, and category",
  },
  {
    icon: Workflow,
    title: "Track Outreach",
    highlighted: false,
    description: () =>
      "CRM with contact staging, owner notes, and follow-up tracking",
  },
  {
    icon: LayoutTemplate,
    title: "Generate Demos",
    highlighted: true,
    href: RING_READY_SITE_URL,
    description: () =>
      "One-click demo site builder to show prospects what their site could look like",
  },
] as const;

const HOME_TOP_CATEGORIES = 30;
const HOME_TOP_STATES = 8;
const HOME_TOP_CITIES = 27;

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  let lastUpdatedLabel: string | null = null;
  try {
    lastUpdatedLabel = await fetchDirectoryLastUpdatedLabel();
  } catch {
    // omit freshness from meta when directory data is unavailable
  }
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  return {
    title: {
      absolute:
        "Businesses Without a Website | Restaurants, Salons & More — Web Designer Leads",
    },
    description: `Find businesses without a website — including restaurants without a website and salons without a website. Browse by city for businesses without a website near you. B2B lead lists for web designers and agencies.${updated}`,
    alternates: { canonical: absoluteUrl("/") },
  };
}

export default async function HomePage() {
  let cities: Awaited<ReturnType<typeof fetchAllDirectoryCities>> = [];
  let summary: Awaited<ReturnType<typeof fetchDirectorySummary>> | null = null;
  let publishedCategories: Awaited<
    ReturnType<typeof fetchAllPublishedCategoryLinks>
  > = [];
  let topStates: Awaited<ReturnType<typeof fetchTopStates>> = [];
  let facebookCount: number | null = null;
  let ukCount: number | null = null;
  let loadError: string | null = null;
  let industryGroups = fallbackCategoryGroupTaxonomy().groups;

  try {
    const [citiesResult, summaryResult, publishedCategoriesResult, topStatesResult, facebookCountResult, ukCountResult, taxonomyResult] =
      await Promise.all([
        fetchAllDirectoryCities(),
        fetchDirectorySummary(),
        fetchAllPublishedCategoryLinks(),
        fetchTopStates(HOME_TOP_STATES),
        fetchFacebookDirectoryListingTotal(),
        fetchUkListingCount(),
        fetchCategoryGroupTaxonomy(),
      ]);
    cities = citiesResult;
    summary = summaryResult;
    publishedCategories = publishedCategoriesResult;
    topStates = topStatesResult;
    facebookCount = facebookCountResult;
    ukCount = ukCountResult;
    industryGroups = taxonomyResult.groups;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load directory data.";
  }

  const topCategories = publishedCategories.slice(0, HOME_TOP_CATEGORIES);
  const topCities = cities.slice(0, HOME_TOP_CITIES);
  const totalCategoryCount =
    summary?.categoryPageCount ?? publishedCategories.length;
  const totalCityCount = summary?.cityHubCount ?? cities.length;
  const totalStateCount = summary?.statePageCount ?? topStates.length;
  const listingCount = summary?.totalListings ?? null;

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          The Prospecting Tool for Web Designers
        </h1>
        <p className="max-w-2xl text-[17px] leading-relaxed text-[#4A4A4A] dark:text-zinc-300">
          {listingCount !== null
            ? `Access ${listingCount.toLocaleString()} verified businesses without a website — restaurants, salons, contractors, and more. Sort by city for businesses without a website near you, track outreach, and close clients faster.`
            : "Access verified businesses without a website — restaurants, salons, contractors, and more. Sort by city, track outreach, and close clients faster."}
        </p>
        <Link
          href={SIGN_IN_PATH}
          className="inline-flex rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"
        >
          Start Prospecting Free
        </Link>
      </section>

      <section aria-label="Product features">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_FEATURES.map((feature) => {
            const cardBody = (
              <>
                {feature.highlighted ? (
                  <span className="absolute left-5 top-0 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Key Feature
                  </span>
                ) : null}
                <feature.icon
                  className={`size-6 ${
                    feature.highlighted
                      ? "text-accent"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                  strokeWidth={2.5}
                  fill="currentColor"
                  fillOpacity={0.15}
                  aria-hidden
                />
                <h2 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">
                  {feature.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {feature.description(listingCount)}
                </p>
              </>
            );

            return (
              <li
                key={feature.title}
                className={`relative rounded-xl border px-5 pb-5 pt-5 ${
                  feature.highlighted
                    ? "border-accent bg-accent-muted/60 dark:bg-amber-950/20"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {"href" in feature && feature.href ? (
                  <a
                    href={feature.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {cardBody}
                  </a>
                ) : (
                  cardBody
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : (
        <>
          {facebookCount !== null && facebookCount > 0 ? (
            <Link
              href="/facebook"
              className="group block rounded-l-lg border-l-4 border-accent bg-accent-muted/80 px-3 py-3 transition-colors hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/45"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300">
                Why this matters
              </p>
              <p className="mt-1 text-base font-semibold leading-snug text-zinc-900 group-hover:text-amber-950 dark:text-zinc-50">
                {`${facebookCount.toLocaleString()} high-intent leads use Facebook as their website, actively violating Google's guidelines and making them prime outreach targets.`}
              </p>
            </Link>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Categories
            </h2>
            <div className="flex flex-wrap gap-2">
              {industryGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/categories#${group.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900/50"
                >
                  <CategoryGroupIcon
                    groupId={group.id}
                    className="size-3.5 shrink-0 text-zinc-500"
                  />
                  {group.label}
                </Link>
              ))}
            </div>
            {topCategories.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No category pages yet (need {DIRECTORY_MIN_CATEGORY_LISTINGS}+
                listings per category nationwide).
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topCategories.map((cat) => (
                  <li key={cat.categorySlug}>
                    <Link href={cat.href} className={directoryCardLinkClass}>
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
            {totalCategoryCount > 0 ? (
              <div className="flex justify-center pt-2">
                <Link href="/categories" className={directoryOutlineButtonClass}>
                  Browse All {totalCategoryCount.toLocaleString()} Categories →
                </Link>
              </div>
            ) : null}
          </section>

          {ukCount !== null && ukCount > 0 ? (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                United Kingdom
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                {ukCount.toLocaleString()} UK listings where Google Maps has no
                standalone website — browse by nation or city.
              </p>
              <Link
                href="/united-kingdom"
                className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Open UK directory
              </Link>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Browse by state
              </h2>
              {totalStateCount > 0 ? (
                <Link
                  href="/states"
                  className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  View all {totalStateCount.toLocaleString()} states
                </Link>
              ) : null}
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
              {totalCityCount > 0 ? (
                <Link
                  href="/cities"
                  className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  View all {totalCityCount.toLocaleString()} cities
                </Link>
              ) : null}
            </div>
            {topCities.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No city hubs yet (need {DIRECTORY_MIN_CITY_LISTINGS}+ listings per
                city).
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {topCities.map((c) => (
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
                {summary.totalListings.toLocaleString()} prospect records
              </p>
              <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
                across {summary.cityHubCount.toLocaleString()} cities,{" "}
                {summary.statePageCount.toLocaleString()} states, and{" "}
                {summary.categoryPageCount.toLocaleString()} categories — no website,
                ready for outreach
              </p>
              <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
                Browse businesses without a website near you by city or state —
                including restaurants without a website and salons without a website.
              </p>
              {summary.lastUpdatedLabel ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Prospect data last updated: {summary.lastUpdatedLabel}
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
