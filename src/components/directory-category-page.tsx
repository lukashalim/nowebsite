import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DownloadCsvButton } from "@/components/download-csv-button";
import {
  nationwideCategoryPageTitle,
  pluralCategoryForTitle,
} from "@/lib/directory/labels";
import { buildDirectoryListJsonLd } from "@/lib/directory/jsonld";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import type { DirectoryBusiness } from "@/lib/directory/types";

interface DirectoryCategoryPageProps {
  categorySlug: string;
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs?: Set<string>;
}

export function DirectoryCategoryPage({
  categorySlug,
  categoryLabel,
  businesses,
  cityGroups,
  cityCount,
  lastUpdatedLabel,
  publishedCitySlugs,
}: DirectoryCategoryPageProps) {
  const title = nationwideCategoryPageTitle(categoryLabel);
  const path = `/${categorySlug}`;
  const jsonLd = buildDirectoryListJsonLd(businesses, path, title);
  const pluralLower = pluralCategoryForTitle(categoryLabel).toLowerCase();

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
          Browse {businesses.length.toLocaleString()} {pluralLower} across{" "}
          {cityCount.toLocaleString()} US cities that do not have their own website.
          Each listing includes ratings, review counts, phone numbers, and Google Maps
          links for outreach.
        </p>
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      <DirectoryGroupedByCity
        cityGroups={cityGroups}
        publishedCitySlugs={publishedCitySlugs}
      />

      <DownloadCsvButton businesses={businesses} pagePath={path} />
    </div>
  );
}
