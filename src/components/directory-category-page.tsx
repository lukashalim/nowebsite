import Link from "next/link";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { ProCta } from "@/components/pro-cta";
import {
  formatCategoryDisplayName,
  nationwideCategoryPageTitle,
} from "@/lib/directory/labels";
import { buildDirectoryListJsonLd } from "@/lib/directory/jsonld";
import type { DirectoryBusiness } from "@/lib/directory/types";

interface DirectoryCategoryPageProps {
  categorySlug: string;
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  lastUpdatedLabel: string | null;
}

export function DirectoryCategoryPage({
  categorySlug,
  categoryLabel,
  businesses,
  lastUpdatedLabel,
}: DirectoryCategoryPageProps) {
  const title = nationwideCategoryPageTitle(categoryLabel);
  const path = `/${categorySlug}`;
  const jsonLd = buildDirectoryListJsonLd(businesses, path, title);
  const displayCategory = formatCategoryDisplayName(categoryLabel);

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
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          This page lists {businesses.length.toLocaleString()} {displayCategory.toLowerCase()}{" "}
          businesses nationwide that do not have their own website. Use the table for quick
          outreach — call, open Maps, or upgrade to Pro for contact tracking and demo tools.
        </p>
      </header>

      {lastUpdatedLabel ? (
        <p className="text-right text-sm text-gray-400 dark:text-zinc-500">
          Last updated: {lastUpdatedLabel}
        </p>
      ) : null}

      <DirectoryBusinessList businesses={businesses} showCityState />

      <DownloadCsvButton businesses={businesses} pagePath={path} />

      <ProCta />
    </div>
  );
}
