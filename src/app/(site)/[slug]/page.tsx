import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryIcon } from "@/components/category-icon";
import { DirectoryCategoryPage } from "@/components/directory-category-page";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryStatePage } from "@/components/directory-state-page";
import { ProCta } from "@/components/pro-cta";
import {
  categoryLinkLabel,
  categoryPath,
  cityHubMetaDescription,
  cityHubTitle,
  nationwideCategoryMetaDescription,
  nationwideCategoryMetaTitle,
  stateHubMetaDescription,
  stateHubMetaTitle,
} from "@/lib/directory/labels";
import {
  fetchAllValidSlugParams,
  fetchCityHub,
  fetchCityListings,
  fetchNationwideCategoryListings,
  fetchStateListings,
} from "@/lib/directory/data";
import {
  isCanonicalCategorySlug,
  legacyCategorySlugToCanonical,
  parseCitySlug,
  parseStateSlug,
} from "@/lib/directory/slugs";
import { DIRECTORY_MIN_CATEGORY_LISTINGS } from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    return await fetchAllValidSlugParams();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lower = slug.trim().toLowerCase();

  const legacyCanonical = legacyCategorySlugToCanonical(lower);
  if (legacyCanonical) {
    return { title: "Redirecting…" };
  }

  if (isCanonicalCategorySlug(lower)) {
    const data = await fetchNationwideCategoryListings(lower);
    if (!data) return { title: "Not found" };
    const title = nationwideCategoryMetaTitle(data.categoryLabel);
    const description = nationwideCategoryMetaDescription(
      data.categoryLabel,
      data.businesses.length,
      data.cityCount,
      data.lastUpdatedLabel,
    );
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(`/${lower}`) },
    };
  }

  if (parseCitySlug(lower)) {
    const hub = await fetchCityHub(lower);
    if (!hub) return { title: "City not found" };
    const title = cityHubTitle(hub.city, hub.state);
    const description = cityHubMetaDescription(
      hub.city,
      hub.state,
      hub.listingCount,
    );
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(`/${lower}`) },
    };
  }

  if (parseStateSlug(lower)) {
    const data = await fetchStateListings(lower);
    if (!data) return { title: "Not found" };
    const title = stateHubMetaTitle(data.state);
    const description = stateHubMetaDescription(
      data.state,
      data.listingCount,
      data.cityCount,
    );
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(`/${lower}`) },
    };
  }

  return { title: "Not found" };
}

export default async function SlugDirectoryPage({ params }: PageProps) {
  const { slug } = await params;
  const lower = slug.trim().toLowerCase();

  const legacyCanonical = legacyCategorySlugToCanonical(lower);
  if (legacyCanonical) {
    permanentRedirect(`/${legacyCanonical}`);
  }

  if (isCanonicalCategorySlug(lower)) {
    const data = await fetchNationwideCategoryListings(lower);
    if (!data) notFound();
    return (
      <DirectoryCategoryPage
        categorySlug={lower}
        categoryLabel={data.categoryLabel}
        businesses={data.businesses}
        cityGroups={data.cityGroups}
        cityCount={data.cityCount}
        lastUpdatedLabel={data.lastUpdatedLabel}
        publishedCitySlugs={data.publishedCitySlugs}
      />
    );
  }

  if (!parseCitySlug(lower)) {
    if (parseStateSlug(lower)) {
      const data = await fetchStateListings(lower);
      if (!data) notFound();
      return (
        <DirectoryStatePage
          stateSlug={lower}
          state={data.state}
          businesses={data.businesses}
          cityGroups={data.cityGroups}
          cityCount={data.cityCount}
          lastUpdatedLabel={data.lastUpdatedLabel}
          publishedCitySlugs={data.publishedCitySlugs}
        />
      );
    }
    notFound();
  }

  const [hub, businesses] = await Promise.all([
    fetchCityHub(lower),
    fetchCityListings(lower),
  ]);
  if (!hub || !businesses) notFound();

  const title = cityHubTitle(hub.city, hub.state);
  const publishedSlugs = new Set(
    hub.publishedCategories.map((c) => c.categorySlug),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          {hub.city}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          {hub.listingCount.toLocaleString()} local businesses in {hub.city} without
          a standalone website — phone numbers, ratings, and Google Maps links for
          outreach. Browse by category when available, or see every listing below.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Categories
        </h2>
        {hub.categories.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Listings are grouped below. No category has{" "}
            {DIRECTORY_MIN_CATEGORY_LISTINGS} or more listings nationwide yet for a
            dedicated category page.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {hub.categories.map((cat) => {
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
              return (
                <li key={cat.categorySlug}>
                  {hasPage ? (
                    <Link
                      href={categoryPath(cat.categorySlug)}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
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
                    <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
                      <CategoryIcon
                        categoryLabel={cat.categoryLabel}
                        className="size-4 shrink-0 text-zinc-400"
                      />
                      <span className="flex flex-1 items-center justify-between gap-2">
                        {inner}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          All listings in {hub.city}
        </h2>
        <DirectoryBusinessList businesses={businesses} />
      </section>

      <ProCta />
    </div>
  );
}
