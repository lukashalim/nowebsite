import Link from "next/link";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { ProCta } from "@/components/pro-cta";
import { stateHubTitle } from "@/lib/directory/labels";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";
import { buildDirectoryListJsonLd } from "@/lib/directory/jsonld";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import type { DirectoryBusiness } from "@/lib/directory/types";

interface DirectoryStatePageProps {
  stateSlug: string;
  state: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs?: Set<string>;
}

export function DirectoryStatePage({
  stateSlug,
  state,
  businesses,
  cityGroups,
  cityCount,
  lastUpdatedLabel,
  publishedCitySlugs,
}: DirectoryStatePageProps) {
  const title = stateHubTitle(state);
  const path = `/${stateSlug}`;
  const displayState = stateAbbrToDisplayName(stateToAbbr(state) ?? state);
  const jsonLd = buildDirectoryListJsonLd(businesses, path, title);

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
          Browse {businesses.length.toLocaleString()} businesses across{" "}
          {cityCount.toLocaleString()} cities in {displayState} that do not have their
          own website. Each listing includes ratings, review counts, phone numbers, and
          Google Maps links for outreach.
        </p>
      </header>

      {lastUpdatedLabel ? (
        <p className="text-right text-sm text-gray-400 dark:text-zinc-500">
          Last updated: {lastUpdatedLabel}
        </p>
      ) : null}

      <DirectoryGroupedByCity
        cityGroups={cityGroups}
        publishedCitySlugs={publishedCitySlugs}
      />

      <DownloadCsvButton businesses={businesses} pagePath={path} />

      <ProCta />
    </div>
  );
}
