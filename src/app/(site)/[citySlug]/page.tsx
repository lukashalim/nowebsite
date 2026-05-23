import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { ProCta } from "@/components/pro-cta";
import {
  categoryLinkLabel,
  categoryPath,
  cityHubMetaDescription,
  cityHubTitle,
} from "@/lib/directory/labels";
import {
  fetchAllValidCitySlugs,
  fetchCityHub,
  fetchCityListings,
} from "@/lib/directory/data";
import { DIRECTORY_MIN_LISTINGS } from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ citySlug: string }>;
}

export async function generateStaticParams() {
  try {
    return await fetchAllValidCitySlugs();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const hub = await fetchCityHub(citySlug);
  if (!hub) {
    return { title: "City not found" };
  }
  const title = cityHubTitle(hub.city, hub.state);
  const description = cityHubMetaDescription(
    hub.city,
    hub.state,
    hub.categories.length,
  );
  const path = `/${citySlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl(path) },
  };
}

export default async function CityHubPage({ params }: PageProps) {
  const { citySlug } = await params;
  const [hub, businesses] = await Promise.all([
    fetchCityHub(citySlug),
    fetchCityListings(citySlug),
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
          These local businesses in {hub.city} do not have a standalone website.
          Browse by category below — each page lists phone numbers, ratings, and
          Google Maps links you can use for outreach.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Categories
        </h2>
        {hub.categories.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Listings are grouped below. No category has {DIRECTORY_MIN_LISTINGS} or
            more listings yet for a dedicated category page.
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
                      href={categoryPath(citySlug, cat.categoryLabel)}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
                      {inner}
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
