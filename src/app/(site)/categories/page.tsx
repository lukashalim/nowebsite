import type { Metadata } from "next";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { fetchAllPublishedCategoryLinks } from "@/lib/directory/data";
import { categoryGridLabel } from "@/lib/directory/labels";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "All categories | Businesses without a website" },
  description:
    "Browse nationwide directories of local businesses without their own website — by trade and service category.",
  alternates: { canonical: absoluteUrl("/categories") },
};

export default async function CategoriesIndexPage() {
  let categories: Awaited<ReturnType<typeof fetchAllPublishedCategoryLinks>> =
    [];
  let loadError: string | null = null;

  try {
    categories = await fetchAllPublishedCategoryLinks();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load categories.";
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          All categories
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Each category page lists no-website businesses nationwide in that trade,
          with ratings, phones, and Google Maps links.
        </p>
      </header>

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-zinc-500">No category directories yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <li key={cat.categorySlug}>
              <Link
                href={cat.href}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
              >
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
      )}
    </div>
  );
}
