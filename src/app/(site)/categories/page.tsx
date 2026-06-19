import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGroupIcon } from "@/components/category-group-icon";
import { CategoryIcon } from "@/components/category-icon";
import { DirectoryBreadcrumbs } from "@/components/directory-breadcrumbs";
import { DirectoryHubNav } from "@/components/directory-hub-nav";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import {
  fetchAllPublishedCategoryLinks,
  fetchDirectoryLastUpdatedLabel,
} from "@/lib/directory/data";
import {
  groupPublishedCategories,
  fetchCategoryGroupTaxonomy,
  fallbackCategoryGroupTaxonomy,
} from "@/lib/directory/category-groups";
import { categoryGridLabel } from "@/lib/directory/labels";
import { directoryCardLinkClass } from "@/lib/directory/ui-classes";
import { DIRECTORY_MIN_CATEGORY_LISTINGS } from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";

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
    title: { absolute: "Businesses Without a Website by Category | Web Designer Leads" },
    description: `Browse restaurants without a website, salons without a website, and other category lead lists — B2B prospecting data for web design agencies.${updated}`,
    alternates: { canonical: absoluteUrl("/categories") },
  };
}

export default async function CategoriesIndexPage() {
  let categories: Awaited<ReturnType<typeof fetchAllPublishedCategoryLinks>> =
    [];
  let lastUpdatedLabel: string | null = null;
  let loadError: string | null = null;
  let taxonomy = fallbackCategoryGroupTaxonomy();

  try {
    [categories, lastUpdatedLabel, taxonomy] = await Promise.all([
      fetchAllPublishedCategoryLinks(),
      fetchDirectoryLastUpdatedLabel(),
      fetchCategoryGroupTaxonomy(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load categories.";
  }

  const grouped = groupPublishedCategories(categories, taxonomy);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <DirectoryBreadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "All categories" }]}
          pagePath="/categories"
        />
        <DirectoryHubNav active="categories" />
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          All categories
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Each category page lists no-website businesses nationwide in that trade,
          grouped by city, with ratings, phones, and Google Maps links. Pages require
          at least {DIRECTORY_MIN_CATEGORY_LISTINGS} listings.
        </p>
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-zinc-500">No category directories yet.</p>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ group, items }) => (
            <section key={group.id} id={group.id} className="scroll-mt-6 space-y-4">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  <CategoryGroupIcon
                    groupId={group.id}
                    className="size-5 shrink-0 text-zinc-500"
                  />
                  {group.label}
                </h2>
                <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                  {group.description}
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((cat) => (
                  <li key={cat.categorySlug}>
                    <Link href={cat.href} className={directoryCardLinkClass}>
                      <CategoryIcon
                        categoryLabel={cat.categoryLabel}
                        className="mt-0.5 size-5 shrink-0 text-zinc-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                          {categoryGridLabel(cat.categoryLabel)}
                        </span>
                        <span className="tabular-nums text-xs text-zinc-500">
                          {cat.count.toLocaleString()} nationwide
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
