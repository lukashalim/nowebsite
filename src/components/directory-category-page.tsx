import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryPagination } from "@/components/directory-pagination";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { BuyFullListCta } from "@/components/buy-full-list-cta";
import { DirectoryProspectingAboutData } from "@/components/directory-city-page-copy";
import { DirectoryBreadcrumbs } from "@/components/directory-breadcrumbs";
import { DirectoryExploreMore } from "@/components/directory-explore-more";
import {
  resolveCategoryPitch,
  type CategoryContent,
} from "@/lib/directory/category-content";
import {
  categoryAboutPlaceLabel,
  categoryHubAboutCopy,
  categoryGridSeoLabel,
  categoryPath,
  categorySeoPlural,
  categoryWithoutWebsiteTitle,
  cityPath,
  formatLocationLabel,
  nationwideCategoryPageTitle,
  pluralCategoryForTitle,
} from "@/lib/directory/labels";
import { fetchAllPublishedCategoryLinks } from "@/lib/directory/data";
import {
  categoryGroupForSlug,
  fetchCategoryGroupTaxonomy,
} from "@/lib/directory/category-groups";
import { buildProspectingDatasetJsonLd } from "@/lib/directory/jsonld";
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
  directoryCalloutClass,
} from "@/lib/directory/ui-classes";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import type { DirectoryBusiness } from "@/lib/directory/types";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";

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
  exportAccess: DirectoryContactAccess;
  isPro?: boolean;
}

export async function DirectoryCategoryPage({
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
  exportAccess,
  isPro = false,
}: DirectoryCategoryPageProps) {
  const title = nationwideCategoryPageTitle(categoryLabel, categorySlug);
  const path = `/${categorySlug}`;
  const pluralLower = categorySeoPlural(categoryLabel, categorySlug).toLowerCase();
  const keywordPhrase = categoryWithoutWebsiteTitle(categoryLabel, categorySlug).toLowerCase();
  const aboutPlace = categoryAboutPlaceLabel(categoryLabel, categorySlug);
  const aboutCopy = categoryHubAboutCopy(categoryLabel, categorySlug);
  const paginated = totalPages > 1;
  const headerDescription = paginated
    ? `Prospecting data for agencies: page ${page.toLocaleString()} of ${totalPages.toLocaleString()} (${totalCount.toLocaleString()} ${pluralLower} across ${cityCount.toLocaleString()} US cities). Export-ready B2B lead list sorted by review volume with outreach signals and reveal-gated contact fields.`
    : `Prospecting data for agencies: ${totalCount.toLocaleString()} ${pluralLower} across ${cityCount.toLocaleString()} US cities with no standalone website. Export-ready list with review counts and reveal-gated contact fields for outreach.`;
  const jsonLd = buildProspectingDatasetJsonLd({
    name: title,
    description: headerDescription,
    path,
    recordCount: totalCount,
    keywords: [keywordPhrase, pluralLower, "businesses without website"],
  });
  const range = directoryPageRange(page, pageSize, totalCount);
  const hrefForPage = (p: number) =>
    categoryPathWithPage(categorySlug, p, filters);
  const pitch = resolveCategoryPitch(categorySlug, content);
  const showPitch = Boolean(
    pitch && page === 1 && !hasActiveDirectoryListingFilters(filters),
  );
  const filtersActive = hasActiveDirectoryListingFilters(filters);

  const [taxonomy, publishedCategories] = await Promise.all([
    fetchCategoryGroupTaxonomy(),
    fetchAllPublishedCategoryLinks(),
  ]);
  const groupId = categoryGroupForSlug(categorySlug, taxonomy);
  const publishedSlugs = new Set(
    publishedCategories.map((c) => c.categorySlug),
  );
  const relatedExploreLinks = publishedCategories
    .filter(
      (c) =>
        c.categorySlug !== categorySlug &&
        groupId != null &&
        categoryGroupForSlug(c.categorySlug, taxonomy) === groupId,
    )
    .slice(0, 6)
    .map((c) => ({
      href: categoryPath(c.categorySlug),
      label: categoryGridSeoLabel(
        c.categoryLabel,
        c.count,
        c.categorySlug,
      ),
    }));

  const topCityLinks = cityGroups
    .filter((g) => publishedCitySlugs?.has(g.citySlug))
    .map((g) => ({
      href: cityPath(g.citySlug),
      label: `${categoryWithoutWebsiteTitle(categoryLabel, categorySlug)} in ${formatLocationLabel(
        g.city,
        g.state,
        g.country,
        g.region,
      )}`,
      count: g.businesses.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(({ href, label }) => ({ href, label }));

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "All categories", href: "/categories" },
    { label: title },
  ];

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-3">
        <DirectoryBreadcrumbs items={breadcrumbItems} pagePath={path} />
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
          {paginated ? (
            <span className="text-xl font-normal text-zinc-500">
              {" "}
              — Page {page.toLocaleString()}
            </span>
          ) : null}
        </h1>

        {showPitch && pitch ? (
          <p className="max-w-2xl whitespace-pre-line text-base text-zinc-600 dark:text-zinc-400">
            {pitch}
          </p>
        ) : (
          <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            {paginated ? (
              <>
                Prospecting data for agencies: page {page.toLocaleString()} of{" "}
                {totalPages.toLocaleString()} ({totalCount.toLocaleString()}{" "}
                {pluralLower} across {cityCount.toLocaleString()} US cities).
                Export-ready B2B lead list sorted by review volume with outreach
                signals and reveal-gated contact fields.
              </>
            ) : (
              <>
                Prospecting data for agencies: {totalCount.toLocaleString()}{" "}
                {pluralLower} across {cityCount.toLocaleString()} US cities with
                no standalone website. Export-ready list with review counts and
                reveal-gated contact fields for outreach.
              </>
            )}
          </p>
        )}

        {!isPro && totalCount > 0 ? (
          <BuyFullListCta />
        ) : null}

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
              variant="category"
              contactAccess={contactAccess}
              publishedCitySlugs={publishedCitySlugs}
              publishedCategorySlugs={publishedSlugs}
            />
          </>
        ) : cityGroups.length > 0 ? (
          <DirectoryGroupedByCity
            cityGroups={cityGroups}
            publishedCitySlugs={publishedCitySlugs}
            listingFilters={filters}
            variant="category"
            showCityState
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

      {totalCount > 0 ? (
        <DownloadCsvButton
          exportAccess={exportAccess}
          pagePath={path}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={totalCount}
          isPro={isPro}
        />
      ) : null}

      {topCityLinks.length > 0 && !paginated ? (
        <DirectoryExploreMore
          heading={`Top cities for ${keywordPhrase}`}
          links={topCityLinks}
        />
      ) : null}

      <DirectoryExploreMore
        heading="Related categories"
        links={relatedExploreLinks}
      />

      <DirectoryProspectingAboutData place={aboutPlace} copy={aboutCopy} />
    </div>
  );
}
