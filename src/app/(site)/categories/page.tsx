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
import { categoryGridSeoLabel } from "@/lib/directory/labels";
import { directoryCardLinkClass } from "@/lib/directory/ui-classes";
import { DIRECTORY_MIN_CATEGORY_LISTINGS } from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";
import { directoryOpenGraph } from "@/lib/site-metadata";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  let lastUpdatedLabel: string | null = null;
  try {
    lastUpdatedLabel = await fetchDirectoryLastUpdatedLabel();
  } catch {
    // omit freshness from meta when directory data is unavailable
  }
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  const title = "Businesses Without a Website by Category | Web Designer Leads";
  const description = `Browse restaurants without a website, salons without a website, and other category lead lists — B2B prospecting data for web design agencies.${updated}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl("/categories") },
    ...directoryOpenGraph({ title, description, path: "/categories" }),
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
          Businesses Without a Website by Category
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Browse restaurants without a website, salons without a website, and
          other nationwide category lists. Each page groups no-website businesses
          by city with ratings, phones, and Google Maps links. Pages require at
          least {DIRECTORY_MIN_CATEGORY_LISTINGS} listings nationwide.
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
                          {categoryGridSeoLabel(
                            cat.categoryLabel,
                            cat.count,
                            cat.categorySlug,
                          )}
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
