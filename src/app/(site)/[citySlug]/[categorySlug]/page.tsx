import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { ProCta } from "@/components/pro-cta";
import {
  categoryMetaDescription,
  categoryPageTitle,
  cityPath,
  formatCategoryDisplayName,
  formatCityState,
} from "@/lib/directory/labels";
import {
  fetchAllValidCityCategorySlugs,
  fetchCategoryListings,
} from "@/lib/directory/data";
import { buildDirectoryListJsonLd } from "@/lib/directory/jsonld";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ citySlug: string; categorySlug: string }>;
}

export async function generateStaticParams() {
  try {
    return await fetchAllValidCityCategorySlugs();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug, categorySlug } = await params;
  const data = await fetchCategoryListings(citySlug, categorySlug);
  if (!data) {
    return { title: "Not found" };
  }
  const title = categoryPageTitle(data.city, data.state, data.categoryLabel);
  const description = categoryMetaDescription(
    data.city,
    data.state,
    data.categoryLabel,
    data.businesses.length,
  );
  const path = `/${citySlug}/${categorySlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl(path) },
  };
}

export default async function CategoryDirectoryPage({ params }: PageProps) {
  const { citySlug, categorySlug } = await params;
  const data = await fetchCategoryListings(citySlug, categorySlug);
  if (!data) notFound();

  const title = categoryPageTitle(data.city, data.state, data.categoryLabel);
  const place = formatCityState(data.city, data.state);
  const path = `/${citySlug}/${categorySlug}`;
  const jsonLd = buildDirectoryListJsonLd(data.businesses, path, title);

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
          <span aria-hidden> / </span>
          <Link href={cityPath(citySlug)} className="hover:underline">
            {place}
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          This page lists {data.businesses.length} local{" "}
          {formatCategoryDisplayName(data.categoryLabel).toLowerCase()} businesses in {place} that do not have
          their own website. Use the table for quick outreach — call, open Maps, or
          upgrade to Pro for contact tracking and demo tools.
        </p>
      </header>

      {data.lastUpdatedLabel ? (
        <p className="text-right text-sm text-gray-400 dark:text-zinc-500">
          Last updated: {data.lastUpdatedLabel}
        </p>
      ) : null}

      <DirectoryBusinessList businesses={data.businesses} />

      <DownloadCsvButton businesses={data.businesses} pagePath={path} />

      <ProCta />
    </div>
  );
}
