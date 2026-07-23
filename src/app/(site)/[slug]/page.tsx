import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryGroupIcon } from "@/components/category-group-icon";
import { CategoryIcon } from "@/components/category-icon";
import { DirectoryCategoryPage } from "@/components/directory-category-page";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryBreadcrumbs } from "@/components/directory-breadcrumbs";
import { DirectoryExploreMore } from "@/components/directory-explore-more";
import {
  DirectoryCityAboutData,
  DirectoryCityRevealCopy,
} from "@/components/directory-city-page-copy";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { BuyFullListCta } from "@/components/buy-full-list-cta";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryListingFilters } from "@/components/directory-listing-filters";
import { DirectoryStatePage } from "@/components/directory-state-page";
import {
  categoryPath,
  cityCategoryLinkLabel,
  cityHubCategoryH2,
  cityHubCategoryIntro,
  cityHubHeaderSubcopy,
  cityHubH1,
  cityHubMetaDescription,
  cityHubMetaTitle,
  cityHubPlaceLabel,
  cityHubProspectListH2,
  cityPath,
  formatCityState,
  nationwideCategoryMetaDescription,
  nationwideCategoryMetaTitle,
  stateHubMetaDescription,
  stateHubMetaTitle,
  statePath,
} from "@/lib/directory/labels";
import { fetchAllDirectoryCities, fetchAllValidSlugParams } from "@/lib/directory/data";
import { stateAbbrToDisplayName, stateNameToSlug, stateToAbbr } from "@/lib/directory/slugs";
import { groupPublishedCategories, fetchCategoryGroupTaxonomy } from "@/lib/directory/category-groups";
import { resolveDirectorySlugPage } from "@/lib/directory/resolve-slug-page";
import { DIRECTORY_MIN_CATEGORY_LISTINGS, DIRECTORY_MIN_CITY_LISTINGS } from "@/lib/directory/types";
import {
  directoryRowLinkStaticClass,
  directoryRowLinkWithGapClass,
} from "@/lib/directory/ui-classes";
import { hasActiveDirectoryListingFilters } from "@/lib/directory/listing-filters";
import { parseDirectoryListingFilters } from "@/lib/directory/listing-filters";
import {
  categoryPathWithPage,
  cityPathWithPage,
  directoryPageRange,
  parseDirectoryPageParam,
  statePathWithPage,
} from "@/lib/directory/pagination";
import { categoryContentMetaDescription, resolveCategoryPitch } from "@/lib/directory/category-content";
import { buildProspectingDatasetJsonLd } from "@/lib/directory/jsonld";
import { absoluteUrl } from "@/lib/site-url";
import { directoryOpenGraph } from "@/lib/site-metadata";
import { getAuthenticatedUserProfile, isPro } from "@/lib/subscription";
import { createDirectoryContactAccess } from "@/lib/directory/contact-access";
import { canRevealDirectoryPageContacts } from "@/lib/directory/free-browse-limits";
import { DirectoryPagination } from "@/components/directory-pagination";
import {
  listingScopeForCategory,
  listingScopeForCity,
  listingScopeForState,
} from "@/lib/directory/listing-scope";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  try {
    return await fetchAllValidSlugParams();
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await searchParams;
  const page = parseDirectoryPageParam(raw.page);
  const filters = parseDirectoryListingFilters(raw);
  const resolved = await resolveDirectorySlugPage(slug, page, filters);

  if (resolved.kind === "redirect") {
    return { title: "Redirecting…" };
  }

  if (resolved.kind === "category") {
    const { data } = resolved;
    const slugLower = slug.trim().toLowerCase();
    const title = nationwideCategoryMetaTitle(
      data.categoryLabel,
      data.page > 1 ? data.page : undefined,
      slugLower,
    );
    const descriptionPitch = resolveCategoryPitch(slugLower, data.content);
    const description =
      data.page === 1 && descriptionPitch
        ? categoryContentMetaDescription(descriptionPitch)
        : nationwideCategoryMetaDescription(
            data.categoryLabel,
            data.totalCount,
            data.cityCount,
            data.lastUpdatedLabel,
            data.totalPages > 1
              ? { current: data.page, totalPages: data.totalPages }
              : undefined,
            slugLower,
          );
    const canonicalPath = hasActiveDirectoryListingFilters(filters)
      ? categoryPathWithPage(slugLower, 1)
      : categoryPathWithPage(slugLower, data.page, data.filters);
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(canonicalPath) },
      ...directoryOpenGraph({ title, description, path: canonicalPath }),
    };
  }

  if (resolved.kind === "city") {
    const { hub, cityData } = resolved;
    const slugLower = slug.trim().toLowerCase();
    const title = cityHubMetaTitle(hub.city, hub.state, hub.country);
    const description = cityHubMetaDescription(
      hub.city,
      hub.state,
      cityData.unfilteredCount,
      hub.lastUpdatedLabel,
      hub.country,
    );
    const canonicalPath = hasActiveDirectoryListingFilters(filters)
      ? cityPathWithPage(slugLower, 1)
      : cityPathWithPage(slugLower, cityData.page, cityData.filters);
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(canonicalPath) },
      ...directoryOpenGraph({ title, description, path: canonicalPath }),
    };
  }

  if (resolved.kind === "state") {
    const { data } = resolved;
    const slugLower = slug.trim().toLowerCase();
    const title = stateHubMetaTitle(
      data.state,
      data.page > 1 ? data.page : undefined,
    );
    const description = stateHubMetaDescription(
      data.state,
      data.totalCount,
      data.cityCount,
      data.lastUpdatedLabel,
      data.totalPages > 1
        ? { current: data.page, totalPages: data.totalPages }
        : undefined,
    );
    const canonicalPath = hasActiveDirectoryListingFilters(filters)
      ? statePathWithPage(slugLower, 1)
      : statePathWithPage(slugLower, data.page, data.filters);
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(canonicalPath) },
      ...directoryOpenGraph({ title, description, path: canonicalPath }),
    };
  }

  return { title: "Not found" };
}

export default async function SlugDirectoryPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const raw = await searchParams;
  const page = parseDirectoryPageParam(raw.page);
  const filters = parseDirectoryListingFilters(raw);
  const lower = slug.trim().toLowerCase();
  const resolved = await resolveDirectorySlugPage(slug, page, filters);
  const auth = await getAuthenticatedUserProfile();
  const userIsPro = isPro(auth?.profile);

  if (resolved.kind === "redirect") {
    permanentRedirect(`/${resolved.to}`);
  }

  if (resolved.kind === "category") {
    const { data } = resolved;
    const contactAccess = canRevealDirectoryPageContacts(
      "category",
      data.page,
      userIsPro,
    )
      ? createDirectoryContactAccess(
          listingScopeForCategory(lower),
          data.page,
          data.filters,
        )
      : null;
    const exportAccess = createDirectoryContactAccess(
      listingScopeForCategory(lower),
      1,
      data.filters,
    );
    return (
      <DirectoryCategoryPage
        categorySlug={lower}
        categoryLabel={data.categoryLabel}
        businesses={data.businesses}
        cityGroups={data.cityGroups}
        cityCount={data.cityCount}
        totalCount={data.totalCount}
        unfilteredCount={data.unfilteredCount}
        page={data.page}
        pageSize={data.pageSize}
        totalPages={data.totalPages}
        lastUpdatedLabel={data.lastUpdatedLabel}
        publishedCitySlugs={data.publishedCitySlugs}
        content={data.content}
        filters={data.filters}
        filterOptions={data.filterOptions}
        contactAccess={contactAccess}
        exportAccess={exportAccess}
        isPro={userIsPro}
      />
    );
  }

  if (resolved.kind === "state") {
    const { data } = resolved;
    const contactAccess = createDirectoryContactAccess(
      listingScopeForState(lower),
      data.page,
      data.filters,
    );
    const exportAccess = createDirectoryContactAccess(
      listingScopeForState(lower),
      1,
      data.filters,
    );
    return (
      <DirectoryStatePage
        stateSlug={lower}
        state={data.state}
        businesses={data.businesses}
        cityGroups={data.cityGroups}
        cityCount={data.cityCount}
        totalCount={data.totalCount}
        unfilteredCount={data.unfilteredCount}
        page={data.page}
        pageSize={data.pageSize}
        totalPages={data.totalPages}
        lastUpdatedLabel={data.lastUpdatedLabel}
        publishedCitySlugs={data.publishedCitySlugs}
        filters={data.filters}
        filterOptions={data.filterOptions}
        contactAccess={contactAccess}
        exportAccess={exportAccess}
        isPro={userIsPro}
      />
    );
  }

  if (resolved.kind === "city") {
    const { hub, businesses, cityData } = resolved;
    const contactAccess = canRevealDirectoryPageContacts(
      "city",
      cityData.page,
      userIsPro,
    )
      ? createDirectoryContactAccess(
          listingScopeForCity(lower),
          cityData.page,
          cityData.filters,
        )
      : null;
    const exportAccess = createDirectoryContactAccess(
      listingScopeForCity(lower),
      1,
      cityData.filters,
    );
    const place = cityHubPlaceLabel(hub.city, hub.state, hub.country);
    const h1 = cityHubH1(hub.city, hub.state, hub.country);
    const topCategory = [...hub.categories].sort(
      (a, b) => b.listingCount - a.listingCount,
    )[0];
    const publishedSlugs = new Set(
      hub.publishedCategories.map((c) => c.categorySlug),
    );
    const taxonomy = await fetchCategoryGroupTaxonomy();
    const groupedCategories = groupPublishedCategories(hub.categories, taxonomy);

    const renderCityCategory = (
      cat: (typeof hub.categories)[number],
    ) => {
      const hasPage = publishedSlugs.has(cat.categorySlug);
      const inner = (
        <>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {cityCategoryLinkLabel(
              cat.categoryLabel,
              cat.listingCount,
              cat.categorySlug,
            )}
          </span>
          <span className="tabular-nums text-zinc-500">
            {!hasPage ? (
              <span className="text-xs font-normal text-zinc-400">(in table)</span>
            ) : null}
          </span>
        </>
      );
      return hasPage ? (
        <Link
          href={categoryPath(cat.categorySlug)}
          className={directoryRowLinkWithGapClass}
        >
          <CategoryIcon
            categoryLabel={cat.categoryLabel}
            className="size-4 shrink-0 text-zinc-500"
          />
          <span className="flex flex-1 items-center justify-between gap-2">
            {inner}
          </span>
        </Link>
      ) : (
        <div className={`${directoryRowLinkStaticClass} border-dashed`}>
          <CategoryIcon
            categoryLabel={cat.categoryLabel}
            className="size-4 shrink-0 text-zinc-400"
          />
          <span className="flex flex-1 items-center justify-between gap-2">
            {inner}
          </span>
        </div>
      );
    };

    const restaurantInHub = hub.categories.some(
      (c) => c.categorySlug === "restaurant",
    );
    const cityJsonLd = buildProspectingDatasetJsonLd({
      name: h1,
      description: cityHubMetaDescription(
        hub.city,
        hub.state,
        cityData.unfilteredCount,
        hub.lastUpdatedLabel,
        hub.country,
      ),
      path: `/${lower}`,
      recordCount: cityData.unfilteredCount,
      spatialCoverage: place,
      keywords: [
        "businesses without a website near me",
        "businesses without website near me",
        "businesses without website",
        ...(restaurantInHub ? ["restaurants without a website"] : []),
      ],
    });

    const stateSlug = stateNameToSlug(hub.state);
    const stateDisplay = stateAbbrToDisplayName(stateToAbbr(hub.state) ?? hub.state);
    const allCities = await fetchAllDirectoryCities();
    const siblingCities = allCities
      .filter(
        (c) =>
          c.state === hub.state &&
          c.citySlug !== lower &&
          c.listingCount >= DIRECTORY_MIN_CITY_LISTINGS,
      )
      .sort((a, b) => b.listingCount - a.listingCount)
      .slice(0, 8);

    const cityExploreLinks = [
      ...(stateSlug
        ? [
            {
              href: statePath(stateSlug),
              label: `All cities in ${stateDisplay}`,
            },
          ]
        : []),
      ...siblingCities.map((c) => ({
        href: cityPath(c.citySlug),
        label: formatCityState(c.city, c.state),
      })),
    ];

    const cityBreadcrumbItems = [
      { label: "Home", href: "/" },
      ...(stateSlug
        ? [{ label: stateDisplay, href: statePath(stateSlug) }]
        : []),
      { label: place },
    ];

    const cityPaginated = cityData.totalPages > 1;
    const cityRange = directoryPageRange(
      cityData.page,
      cityData.pageSize,
      cityData.totalCount,
    );
    const cityHrefForPage = (p: number) =>
      cityPathWithPage(lower, p, cityData.filters);

    return (
      <div className="space-y-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJsonLd) }}
        />

        <header className="space-y-3">
          <DirectoryBreadcrumbs
            items={cityBreadcrumbItems}
            pagePath={`/${lower}`}
          />
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {h1}
          </h1>
          <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            {cityHubHeaderSubcopy(
              place,
              hub.city,
              cityData.unfilteredCount,
              topCategory,
            )}
          </p>
          {!userIsPro && cityData.unfilteredCount > 0 ? (
            <BuyFullListCta
              categoryOrCity={lower}
              exportAccess={exportAccess}
              pagePath={`/${lower}`}
              totalCount={cityData.totalCount}
            />
          ) : null}
        </header>

        <DirectoryLastUpdated label={hub.lastUpdatedLabel} />

        <DirectoryListingFilters
          action={`/${lower}`}
          mode="reviewsOnly"
          filters={cityData.filters}
          filterOptions={cityData.filterOptions}
          unfilteredCount={cityData.unfilteredCount}
          totalCount={cityData.totalCount}
        />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {cityHubCategoryH2(hub.city)}
          </h2>
          {hub.categories.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Listings are grouped below. No category has{" "}
              {DIRECTORY_MIN_CATEGORY_LISTINGS} or more listings nationwide yet for a
              dedicated category page.
            </p>
          ) : (
            <div className="space-y-6">
              <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                {cityHubCategoryIntro(place, hub.city, topCategory?.categoryLabel)}
              </p>
              {groupedCategories.map(({ group, items }) => (
                <div key={group.id} className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <CategoryGroupIcon
                      groupId={group.id}
                      className="size-4 shrink-0 text-zinc-500"
                    />
                    {group.label}
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {items.map((cat) => (
                      <li key={cat.categorySlug}>{renderCityCategory(cat)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {cityHubProspectListH2(place)}
          </h2>
          <DirectoryCityRevealCopy
            place={place}
            count={cityData.unfilteredCount}
            categoryCount={hub.categories.length}
          />
          {cityPaginated ? (
            <DirectoryPagination
              hrefForPage={cityHrefForPage}
              page={cityData.page}
              totalPages={cityData.totalPages}
              totalCount={cityData.totalCount}
              rangeStart={cityRange.start}
              rangeEnd={cityRange.end}
              ariaLabel="City listings pagination"
            />
          ) : null}
          {businesses.length > 0 ? (
            <DirectoryBusinessList
              businesses={businesses}
              contactAccess={contactAccess}
            />
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No listings match these filters.
            </p>
          )}
          {cityPaginated ? (
            <DirectoryPagination
              hrefForPage={cityHrefForPage}
              page={cityData.page}
              totalPages={cityData.totalPages}
              totalCount={cityData.totalCount}
              rangeStart={cityRange.start}
              rangeEnd={cityRange.end}
              ariaLabel="City listings pagination"
            />
          ) : null}
        </section>

        {businesses.length > 0 ? (
          <DownloadCsvButton
            exportAccess={exportAccess}
            pagePath={`/${lower}`}
            pageSize={cityData.pageSize}
            totalPages={cityData.totalPages}
            totalCount={cityData.totalCount}
            categoryOrCity={lower}
            isPro={userIsPro}
          />
        ) : null}

        <DirectoryExploreMore
          heading={`More cities in ${stateDisplay}`}
          links={cityExploreLinks}
        />

        <DirectoryCityAboutData place={place} />
      </div>
    );
  }

  notFound();
}
