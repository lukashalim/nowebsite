import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryPagination } from "@/components/directory-pagination";
import { DownloadCsvButton } from "@/components/download-csv-button";
import {
  nationwideCategoryPageTitle,
  pluralCategoryForTitle,
} from "@/lib/directory/labels";
import { buildDirectoryListJsonLd } from "@/lib/directory/jsonld";
import {
  categoryPathWithPage,
  directoryPageRange,
} from "@/lib/directory/pagination";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import type { DirectoryBusiness } from "@/lib/directory/types";

interface DirectoryCategoryPageProps {
  categorySlug: string;
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs?: Set<string>;
}

export function DirectoryCategoryPage({
  categorySlug,
  categoryLabel,
  businesses,
  cityGroups,
  cityCount,
  totalCount,
  page,
  pageSize,
  totalPages,
  lastUpdatedLabel,
  publishedCitySlugs,
}: DirectoryCategoryPageProps) {
  const title = nationwideCategoryPageTitle(categoryLabel);
  const path = `/${categorySlug}`;
  const jsonLd = buildDirectoryListJsonLd(businesses, path, title);
  const pluralLower = pluralCategoryForTitle(categoryLabel).toLowerCase();
  const paginated = totalPages > 1;
  const range = directoryPageRange(page, pageSize, totalCount);
  const fullCsvHref = `/api/directory-export?slug=${encodeURIComponent(categorySlug)}&type=category`;
  const hrefForPage = (p: number) => categoryPathWithPage(categorySlug, p);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          {paginated ? (
            <>
              <span aria-hidden> / </span>
              <Link href={path} className="hover:underline">
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
          ariaLabel="Category listings pagination"
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
          ariaLabel="Category listings pagination"
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {paginated ? (
          <a
            href={fullCsvHref}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Download all {totalCount.toLocaleString()} as CSV
          </a>
        ) : (
          <DownloadCsvButton businesses={businesses} pagePath={path} />
        )}
        {paginated ? (
          <p className="text-xs text-zinc-500">
            CSV includes every listing in this category, not only this page.
          </p>
        ) : null}
      </div>
    </div>
  );
}
