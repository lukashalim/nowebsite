import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryPagination } from "@/components/directory-pagination";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { stateHubTitle, ukRegionHubTitle } from "@/lib/directory/labels";
import { buildDirectoryListJsonLd } from "@/lib/directory/jsonld";
import {
  directoryPageRange,
  statePathWithPage,
} from "@/lib/directory/pagination";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import type { DirectoryBusiness } from "@/lib/directory/types";

interface DirectoryStatePageProps {
  stateSlug: string;
  state: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs?: Set<string>;
  hubHref?: string;
  hubLabel?: string;
  isUkRegion?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export function DirectoryStatePage({
  stateSlug,
  state,
  businesses,
  cityGroups,
  cityCount,
  lastUpdatedLabel,
  publishedCitySlugs,
  hubHref = "/",
  hubLabel = "Home",
  isUkRegion = false,
  totalCount: totalCountProp,
  page = 1,
  pageSize = 100,
  totalPages = 1,
}: DirectoryStatePageProps) {
  const title = isUkRegion ? ukRegionHubTitle(state) : stateHubTitle(state);
  const path = `/${stateSlug}`;
  const jsonLd = buildDirectoryListJsonLd(businesses, path, title);
  const displayState = isUkRegion
    ? state
    : stateAbbrToDisplayName(stateToAbbr(state) ?? state);
  const totalCount = totalCountProp ?? businesses.length;
  const paginated = totalPages > 1;
  const range = directoryPageRange(page, pageSize, totalCount);
  const hrefForPage = (p: number) => statePathWithPage(stateSlug, p);
  const fullCsvHref = isUkRegion
    ? null
    : `/api/directory-export?slug=${encodeURIComponent(stateSlug)}&type=state`;

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href={hubHref} className="hover:underline">
            {hubLabel}
          </Link>
          {paginated ? (
            <>
              <span aria-hidden> / </span>
              <Link href={path} className="hover:underline">
                {title}
              </Link>
            </>
          ) : null}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
          {paginated ? (
            <span className="text-xl font-normal text-zinc-500">
              {" "}
              — Page {page.toLocaleString()}
            </span>
          ) : null}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          {paginated ? (
            <>
              Browse page {page.toLocaleString()} of {totalPages.toLocaleString()}{" "}
              ({totalCount.toLocaleString()} businesses across{" "}
              {cityCount.toLocaleString()} {isUkRegion ? "UK " : ""}cities in{" "}
              {displayState}). Listings are sorted by Google review count. Each row
              includes ratings, phone numbers, and Maps links for outreach.
            </>
          ) : (
            <>
              Browse {totalCount.toLocaleString()} businesses across{" "}
              {cityCount.toLocaleString()} {isUkRegion ? "UK " : ""}cities in{" "}
              {displayState} that do not have their own website. Each listing
              includes ratings, review counts, phone numbers, and Google Maps links
              for outreach.
            </>
          )}
        </p>
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      {paginated ? (
        <DirectoryPagination
          hrefForPage={hrefForPage}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          rangeStart={range.start}
          rangeEnd={range.end}
          ariaLabel="State listings pagination"
        />
      ) : null}

      <section className="space-y-3">
        {paginated ? (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Listings
            </h2>
            <DirectoryBusinessList businesses={businesses} showCityState />
          </>
        ) : (
          <DirectoryGroupedByCity
            cityGroups={cityGroups}
            publishedCitySlugs={publishedCitySlugs}
          />
        )}
      </section>

      {paginated ? (
        <DirectoryPagination
          hrefForPage={hrefForPage}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          rangeStart={range.start}
          rangeEnd={range.end}
          ariaLabel="State listings pagination"
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {paginated && fullCsvHref ? (
          <a
            href={fullCsvHref}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Download all {totalCount.toLocaleString()} as CSV
          </a>
        ) : (
          <DownloadCsvButton businesses={businesses} pagePath={path} />
        )}
        {paginated && fullCsvHref ? (
          <p className="text-xs text-zinc-500">
            CSV includes every listing in this state, not only this page.
          </p>
        ) : null}
      </div>
    </div>
  );
}
