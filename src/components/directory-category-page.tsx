import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryPagination } from "@/components/directory-pagination";
import { DownloadCsvButton } from "@/components/download-csv-button";
import type { CategoryContent } from "@/lib/directory/category-content";
import {
  nationwideCategoryPageTitle,
  pluralCategoryForTitle,
} from "@/lib/directory/labels";
import { buildDirectoryListJsonLd } from "@/lib/directory/jsonld";
import { DirectoryListingFilters } from "@/components/directory-listing-filters";
import {
  hasActiveDirectoryListingFilters,
  type DirectoryFilterOptions,
  type DirectoryListingFilters as DirectoryListingFiltersState,
} from "@/lib/directory/listing-filters";
import {
  categoryPathWithPage,
  directoryPageRange,
} from "@/lib/directory/pagination";
import {
  directoryBreadcrumbLinkClass,
  directoryCalloutClass,
} from "@/lib/directory/ui-classes";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import type { DirectoryBusiness } from "@/lib/directory/types";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { stripContactFieldsList } from "@/lib/directory/contact-fields";

interface DirectoryCategoryPageProps {
  categorySlug: string;
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  totalCount: number;
  unfilteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs?: Set<string>;
  content?: CategoryContent | null;
  filters: DirectoryListingFiltersState;
  filterOptions: DirectoryFilterOptions;
  contactAccess: DirectoryContactAccess;
}

export function DirectoryCategoryPage({
  categorySlug,
  categoryLabel,
  businesses,
  cityGroups,
  cityCount,
  totalCount,
  unfilteredCount,
  page,
  pageSize,
  totalPages,
  lastUpdatedLabel,
  publishedCitySlugs,
  content,
  filters,
  filterOptions,
  contactAccess,
}: DirectoryCategoryPageProps) {
  const title = nationwideCategoryPageTitle(categoryLabel);
  const path = `/${categorySlug}`;
  const jsonLd = buildDirectoryListJsonLd(businesses, path, title);
  const pluralLower = pluralCategoryForTitle(categoryLabel).toLowerCase();
  const paginated = totalPages > 1;
  const range = directoryPageRange(page, pageSize, totalCount);
  const hrefForPage = (p: number) =>
    categoryPathWithPage(categorySlug, p, filters);
  const showPitch = Boolean(
    content?.pitch?.trim() && page === 1 && !hasActiveDirectoryListingFilters(filters),
  );
  const filtersActive = hasActiveDirectoryListingFilters(filters);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/" className={directoryBreadcrumbLinkClass}>
            Home
          </Link>
          {paginated ? (
            <>
              <span aria-hidden> / </span>
              <Link href={path} className={directoryBreadcrumbLinkClass}>
                {pluralCategoryForTitle(categoryLabel)}
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

        {showPitch && content ? (
          <p className="max-w-2xl whitespace-pre-line text-base text-zinc-600 dark:text-zinc-400">
            {content.pitch}
          </p>
        ) : (
          <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            {paginated ? (
              <>
                Browse page {page.toLocaleString()} of {totalPages.toLocaleString()}{" "}
                ({totalCount.toLocaleString()} {pluralLower} across{" "}
                {cityCount.toLocaleString()} US cities). Listings are sorted by Google
                review count. Each row includes ratings, phone numbers, and Maps links
                for outreach.
              </>
            ) : (
              <>
                Browse {totalCount.toLocaleString()} {pluralLower} across{" "}
                {cityCount.toLocaleString()} US cities that do not have their own
                website. Each listing includes ratings, review counts, phone numbers,
                and Google Maps links for outreach.
              </>
            )}
          </p>
        )}

        {content && page === 1 && content.websiteAdoptionPct != null ? (
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            About {content.websiteAdoptionPct.toLocaleString()}% of{" "}
            {content.displayName} businesses have their own website — the rest are
            listed here for designers and agencies building sites for them.
          </p>
        ) : null}

        {content && page === 1 && content.outreachAngle ? (
          <div className={directoryCalloutClass}>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Outreach angle
            </h2>
            <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
              {content.outreachAngle}
            </p>
          </div>
        ) : null}
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      <DirectoryListingFilters
        action={path}
        mode="full"
        filters={filters}
        filterOptions={filterOptions}
        unfilteredCount={unfilteredCount}
        totalCount={totalCount}
      />

      {paginated ? (
        <DirectoryPagination
          hrefForPage={hrefForPage}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          rangeStart={range.start}
          rangeEnd={range.end}
          ariaLabel="Category listings pagination"
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
              contactAccess={contactAccess}
            />
          </>
        ) : cityGroups.length > 0 ? (
          <DirectoryGroupedByCity
            cityGroups={cityGroups}
            publishedCitySlugs={publishedCitySlugs}
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
          ariaLabel="Category listings pagination"
        />
      ) : null}

      <DownloadCsvButton
        businesses={stripContactFieldsList(businesses)}
        contactAccess={contactAccess}
        pagePath={path}
      />
    </div>
  );
}
