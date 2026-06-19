import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryPagination } from "@/components/directory-pagination";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { DirectoryProspectingAboutData } from "@/components/directory-city-page-copy";
import { stateHubTitle, stateHubHeaderSubcopy, stateHubAboutCopy, ukRegionHubTitle, ukRegionHubAboutCopy } from "@/lib/directory/labels";
import { buildProspectingDatasetJsonLd } from "@/lib/directory/jsonld";
import { DirectoryListingFilters } from "@/components/directory-listing-filters";
import {
  hasActiveDirectoryListingFilters,
  type DirectoryFilterOptions,
  type DirectoryListingFilters as DirectoryListingFiltersState,
} from "@/lib/directory/listing-filters";
import {
  directoryPageRange,
  statePathWithPage,
} from "@/lib/directory/pagination";
import { directoryBreadcrumbLinkClass } from "@/lib/directory/ui-classes";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import type { DirectoryBusiness } from "@/lib/directory/types";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";

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
  pathPrefix?: string;
  getCityHref?: (group: DirectoryCityGroup) => string;
  isCityPublished?: (group: DirectoryCityGroup) => boolean;
  totalCount?: number;
  unfilteredCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  filters?: DirectoryListingFiltersState;
  filterOptions?: DirectoryFilterOptions;
  contactAccess?: DirectoryContactAccess;
  exportAccess?: DirectoryContactAccess;
  isPro?: boolean;
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
  pathPrefix,
  getCityHref,
  isCityPublished,
  totalCount: totalCountProp,
  unfilteredCount: unfilteredCountProp,
  page = 1,
  pageSize = 100,
  totalPages = 1,
  filters,
  filterOptions,
  contactAccess,
  exportAccess,
  isPro = false,
}: DirectoryStatePageProps) {
  const title = isUkRegion ? ukRegionHubTitle(state) : stateHubTitle(state);
  const path = pathPrefix
    ? `${pathPrefix}/${stateSlug}`
    : `/${stateSlug}`;
  const displayState = isUkRegion
    ? state
    : stateAbbrToDisplayName(stateToAbbr(state) ?? state);
  const totalCount = totalCountProp ?? businesses.length;
  const paginated = totalPages > 1;
  const aboutCopy = isUkRegion
    ? ukRegionHubAboutCopy(displayState)
    : stateHubAboutCopy(displayState);
  const jsonLd = buildProspectingDatasetJsonLd({
    name: title,
    description: stateHubHeaderSubcopy(displayState, totalCount, cityCount, {
      isUkRegion,
      paginated: paginated ? { page, totalPages } : undefined,
    }),
    path,
    recordCount: totalCount,
    spatialCoverage: displayState,
    keywords: isUkRegion
      ? ["UK businesses without website", "businesses without website near me"]
      : ["businesses without website", "businesses without website near me"],
  });
  const range = directoryPageRange(page, pageSize, totalCount);
  const hrefForPage = (p: number) =>
    isUkRegion ? statePathWithPage(stateSlug, p) : statePathWithPage(stateSlug, p, filters);
  const showUsFilters = !isUkRegion && filters && filterOptions;
  const filtersActive = filters ? hasActiveDirectoryListingFilters(filters) : false;
  const unfilteredCount = unfilteredCountProp ?? totalCount;
  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href={hubHref} className={directoryBreadcrumbLinkClass}>
            {hubLabel}
          </Link>
          {paginated ? (
            <>
              <span aria-hidden> / </span>
              <Link href={path} className={directoryBreadcrumbLinkClass}>
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
          {stateHubHeaderSubcopy(displayState, totalCount, cityCount, {
            isUkRegion,
            paginated: paginated ? { page, totalPages } : undefined,
          })}
        </p>
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      {showUsFilters ? (
        <DirectoryListingFilters
          action={path}
          mode="stateFixed"
          filters={filters}
          filterOptions={filterOptions}
          unfilteredCount={unfilteredCount}
          totalCount={totalCount}
          fixedStateLabel={displayState}
        />
      ) : null}

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
            <DirectoryBusinessList
              businesses={businesses}
              showCityState
              contactAccess={contactAccess!}
            />
          </>
        ) : cityGroups.length > 0 ? (
          <DirectoryGroupedByCity
            cityGroups={cityGroups}
            publishedCitySlugs={publishedCitySlugs}
            getCityHref={getCityHref}
            isCityPublished={isCityPublished}
            listingFilters={filters}
          />
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No listings match these filters.
          </p>
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

      {paginated && exportAccess ? (
        <DownloadCsvButton
          exportAccess={exportAccess}
          pagePath={path}
          pageSize={pageSize}
          totalPages={totalPages}
          isPro={isPro}
        />
      ) : null}

      <DirectoryProspectingAboutData place={displayState} copy={aboutCopy} />
    </div>
  );
}
