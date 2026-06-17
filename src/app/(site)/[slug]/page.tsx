import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryGroupIcon } from "@/components/category-group-icon";
import { CategoryIcon } from "@/components/category-icon";
import { DirectoryCategoryPage } from "@/components/directory-category-page";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import {
  DirectoryCityAboutData,
  DirectoryCityRevealCopy,
} from "@/components/directory-city-page-copy";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryListingFilters } from "@/components/directory-listing-filters";
import { DirectoryStatePage } from "@/components/directory-state-page";
import {
  categoryLinkLabel,
  categoryPath,
  cityHubCategoryH2,
  cityHubCategoryIntro,
  cityHubHeaderSubcopy,
  cityHubH1,
  cityHubMetaDescription,
  cityHubMetaTitle,
  cityHubPlaceLabel,
  cityHubProspectListH2,
  nationwideCategoryMetaDescription,
  nationwideCategoryMetaTitle,
  stateHubMetaDescription,
  stateHubMetaTitle,
} from "@/lib/directory/labels";
import { fetchAllValidSlugParams } from "@/lib/directory/data";
import { groupPublishedCategories, fetchCategoryGroupTaxonomy } from "@/lib/directory/category-groups";
import { resolveDirectorySlugPage } from "@/lib/directory/resolve-slug-page";
import { DIRECTORY_MIN_CATEGORY_LISTINGS } from "@/lib/directory/types";
import {
  directoryBreadcrumbLinkClass,
  directoryRowLinkStaticClass,
  directoryRowLinkWithGapClass,
} from "@/lib/directory/ui-classes";
import { hasActiveDirectoryListingFilters } from "@/lib/directory/listing-filters";
import { parseDirectoryListingFilters } from "@/lib/directory/listing-filters";
import {
  categoryPathWithPage,
  cityPathWithQuery,
  parseDirectoryPageParam,
  statePathWithPage,
} from "@/lib/directory/pagination";
import { categoryContentMetaDescription } from "@/lib/directory/category-content";
import { absoluteUrl } from "@/lib/site-url";
import { getAuthenticatedUserProfile, isPro } from "@/lib/subscription";
import { createDirectoryContactAccess } from "@/lib/directory/contact-access";
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
    const title = nationwideCategoryMetaTitle(
      data.categoryLabel,
      data.page > 1 ? data.page : undefined,
    );
    const description =
      data.page === 1 && data.content?.pitch?.trim()
        ? categoryContentMetaDescription(data.content.pitch)
        : nationwideCategoryMetaDescription(
            data.categoryLabel,
            data.totalCount,
            data.cityCount,
            data.lastUpdatedLabel,
            data.totalPages > 1
              ? { current: data.page, totalPages: data.totalPages }
              : undefined,
          );
    const slugLower = slug.trim().toLowerCase();
    const canonicalPath = hasActiveDirectoryListingFilters(filters)
      ? categoryPathWithPage(slugLower, 1)
      : categoryPathWithPage(slugLower, data.page, data.filters);
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(canonicalPath) },
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
      ? `/${slugLower}`
      : cityPathWithQuery(slugLower, cityData.filters);
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(canonicalPath) },
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
    const contactAccess = createDirectoryContactAccess(
      listingScopeForCategory(lower),
      data.page,
      data.filters,
    );
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
    const contactAccess = createDirectoryContactAccess(
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
            {categoryLinkLabel(cat.categoryLabel)}
          </span>
          <span className="tabular-nums text-zinc-500">
            {cat.listingCount}
            {!hasPage ? (
              <span className="ml-1 text-xs font-normal text-zinc-400">
                (in table)
              </span>
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

    return (
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm text-zinc-500">
            <Link href="/" className={directoryBreadcrumbLinkClass}>
              Home
            </Link>
            <span aria-hidden> / </span>
            {hub.city}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {h1}
          </h1>
          <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            {cityHubHeaderSubcopy(
              place,
              hub.city,
              cityData.unfilteredCount,
            )}
          </p>
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
        </section>

        {businesses.length > 0 ? (
          <DownloadCsvButton
            exportAccess={contactAccess}
            pagePath={`/${lower}`}
            pageSize={cityData.pageSize}
            totalPages={cityData.totalPages}
            isPro={userIsPro}
          />
        ) : null}

        <DirectoryCityAboutData place={place} />
      </div>
    );
  }

  notFound();
}
