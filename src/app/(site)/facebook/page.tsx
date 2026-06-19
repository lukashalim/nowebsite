import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryListingFilters } from "@/components/directory-listing-filters";
import { DirectoryPagination } from "@/components/directory-pagination";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { DirectoryProspectingAboutData } from "@/components/directory-city-page-copy";
import {
  fetchAllDirectoryCities,
  fetchFacebookDirectoryPageData,
} from "@/lib/directory/data";
import { buildProspectingDatasetJsonLd } from "@/lib/directory/jsonld";
import {
  FACEBOOK_HUB_PATH,
  facebookAboutPlaceLabel,
  facebookHubAboutCopy,
  facebookHubHeaderSubcopy,
  facebookHubMetaDescription,
  facebookHubMetaTitle,
  facebookHubTitle,
} from "@/lib/directory/labels";
import {
  hasActiveDirectoryListingFilters,
  parseDirectoryListingFilters,
} from "@/lib/directory/listing-filters";
import {
  directoryPageRange,
  facebookPathWithPage,
  parseDirectoryPageParam,
} from "@/lib/directory/pagination";
import { DIRECTORY_MIN_CITY_LISTINGS } from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";
import { getAuthenticatedUserProfile, isPro } from "@/lib/subscription";
import { createDirectoryContactAccess } from "@/lib/directory/contact-access";
import { listingScopeForFacebook } from "@/lib/directory/listing-scope";

export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const raw = await searchParams;
  const page = parseDirectoryPageParam(raw.page);
  const filters = parseDirectoryListingFilters(raw);
  let lastUpdatedLabel: string | null = null;
  let totalCount = 0;
  let totalPages = 1;
  try {
    const data = await fetchFacebookDirectoryPageData({ page, filters });
    lastUpdatedLabel = data.lastUpdatedLabel;
    totalCount = data.totalCount;
    totalPages = data.totalPages;
  } catch {
    // omit freshness from meta when directory data is unavailable
  }
  const canonicalPath = hasActiveDirectoryListingFilters(filters)
    ? facebookPathWithPage(1)
    : facebookPathWithPage(page, filters);
  return {
    title: {
      absolute: facebookHubMetaTitle(page > 1 ? page : undefined),
    },
    description: facebookHubMetaDescription(
      lastUpdatedLabel,
      totalPages > 1
        ? { current: page, totalPages, totalCount }
        : undefined,
    ),
    alternates: { canonical: absoluteUrl(canonicalPath) },
  };
}

export default async function FacebookDirectoryPage({
  searchParams,
}: PageProps) {
  const raw = await searchParams;
  const page = parseDirectoryPageParam(raw.page);
  const filters = parseDirectoryListingFilters(raw);
  let data: Awaited<ReturnType<typeof fetchFacebookDirectoryPageData>> | null =
    null;
  let publishedCitySlugs: Set<string> | undefined;
  let loadError: string | null = null;

  try {
    const [pageData, cities] = await Promise.all([
      fetchFacebookDirectoryPageData({ page, filters }),
      fetchAllDirectoryCities(),
    ]);
    data = pageData;
    publishedCitySlugs = new Set(
      cities
        .filter((c) => c.listingCount >= DIRECTORY_MIN_CITY_LISTINGS)
        .map((c) => c.citySlug),
    );
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Facebook listings.";
  }

  const paginated = Boolean(data && data.totalPages > 1);
  const range = data
    ? directoryPageRange(data.page, data.pageSize, data.totalCount)
    : null;
  const hrefForPage = (p: number) => facebookPathWithPage(p, data?.filters);
  const pageTitle = facebookHubTitle();
  const aboutPlace = facebookAboutPlaceLabel();
  const aboutCopy = facebookHubAboutCopy();

  const contactAccess = data
    ? createDirectoryContactAccess(
        listingScopeForFacebook(),
        data.page,
        data.filters,
      )
    : null;
  const exportAccess = data
    ? createDirectoryContactAccess(
        listingScopeForFacebook(),
        1,
        data.filters,
      )
    : null;
  const auth = await getAuthenticatedUserProfile();
  const userIsPro = isPro(auth?.profile);

  const jsonLd = data
    ? buildProspectingDatasetJsonLd({
        name: pageTitle,
        description: facebookHubHeaderSubcopy(
          data.totalCount,
          data.cityCount,
          paginated ? { page: data.page, totalPages: data.totalPages } : undefined,
        ),
        path: FACEBOOK_HUB_PATH,
        recordCount: data.totalCount,
        keywords: ["Facebook-as-website leads", "Google Business Profile"],
      })
    : null;

  return (
    <div className="space-y-8">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          {paginated ? (
            <>
              <span aria-hidden> / </span>
              <Link href={FACEBOOK_HUB_PATH} className="hover:underline">
                Facebook-as-website leads
              </Link>
            </>
          ) : null}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {pageTitle}
          {paginated && data ? (
            <span className="text-xl font-normal text-zinc-500">
              {" "}
              — Page {data.page.toLocaleString()}
            </span>
          ) : null}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          B2B outreach list for web designers and agencies: these businesses appear
          on Google Maps without a standalone website. Many use a Facebook URL in
          the Website field on their Google Business Profile — a guideline violation
          that can hurt local rankings and visibility.
        </p>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Google&apos;s Business Profile guidelines require the Website field to point
          to a site the business controls, not a social profile. Prospects who
          substitute Facebook for a real site are high-intent targets for web design
          outreach.
        </p>
      </header>

      <div className="max-w-2xl rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
        Google expects an owned website in the Website field. A Facebook or other
        social URL is non-compliant and can reduce local visibility. See{" "}
        <a
          href="https://support.google.com/business/answer/3038177"
          className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-200"
          rel="noopener noreferrer"
          target="_blank"
        >
          Google Business Profile guidelines
        </a>
        .
      </div>

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : data ? (
        <>
          <DirectoryLastUpdated label={data.lastUpdatedLabel} />

          <DirectoryListingFilters
            action={FACEBOOK_HUB_PATH}
            mode="full"
            filters={data.filters}
            filterOptions={data.filterOptions}
            unfilteredCount={data.unfilteredCount}
            totalCount={data.totalCount}
          />

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {facebookHubHeaderSubcopy(
              data.totalCount,
              data.cityCount,
              paginated ? { page: data.page, totalPages: data.totalPages } : undefined,
            )}
          </p>

          {paginated && range ? (
            <DirectoryPagination
              hrefForPage={hrefForPage}
              page={data.page}
              totalPages={data.totalPages}
              totalCount={data.totalCount}
              rangeStart={range.start}
              rangeEnd={range.end}
              ariaLabel="Facebook listings pagination"
            />
          ) : null}

          <section className="space-y-3">
            {paginated ? (
              <>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Prospect list
                </h2>
                {data.businesses.length > 0 ? (
                  <DirectoryBusinessList
                    businesses={data.businesses}
                    showCityState
                    contactAccess={contactAccess!}
                  />
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    No listings match these filters.
                  </p>
                )}
              </>
            ) : data.cityGroups.length > 0 ? (
              <DirectoryGroupedByCity
                cityGroups={data.cityGroups}
                publishedCitySlugs={publishedCitySlugs}
                listingFilters={data.filters}
              />
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No listings match these filters.
              </p>
            )}
          </section>

          {paginated && range ? (
            <DirectoryPagination
              hrefForPage={hrefForPage}
              page={data.page}
              totalPages={data.totalPages}
              totalCount={data.totalCount}
              rangeStart={range.start}
              rangeEnd={range.end}
              ariaLabel="Facebook listings pagination"
            />
          ) : null}

          {data && data.totalCount > 0 && exportAccess ? (
            <DownloadCsvButton
              exportAccess={exportAccess}
              pagePath={FACEBOOK_HUB_PATH}
              pageSize={data.pageSize}
              totalPages={data.totalPages}
              isPro={userIsPro}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            />
          ) : null}

          <DirectoryProspectingAboutData place={aboutPlace} copy={aboutCopy} />
        </>
      ) : null}
    </div>
  );
}
