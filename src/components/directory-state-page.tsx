import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryGroupedByCity } from "@/components/directory-grouped-by-city";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { stateHubTitle, ukRegionHubTitle } from "@/lib/directory/labels";
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
  hubHref?: string;
  hubLabel?: string;
  isUkRegion?: boolean;
}

export function DirectoryStatePage({
  stateSlug,
  state,
  businesses,
  cityGroups,
  cityCount,
  lastUpdatedLabel,
  publishedCitySlugs,
  hubHref = "/",
  hubLabel = "Home",
  isUkRegion = false,
}: DirectoryStatePageProps) {
  const title = isUkRegion ? ukRegionHubTitle(state) : stateHubTitle(state);
  const path = `/${stateSlug}`;
  const displayState = isUkRegion
    ? state
    : stateAbbrToDisplayName(stateToAbbr(state) ?? state);
  const jsonLd = buildDirectoryListJsonLd(businesses, path, title);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href={hubHref} className="hover:underline">
            {hubLabel}
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Browse {businesses.length.toLocaleString()} businesses across{" "}
          {cityCount.toLocaleString()} {isUkRegion ? "UK " : ""}cities in {displayState}{" "}
          that do not have their own website. Each listing includes ratings, review
          counts, phone numbers, and Google Maps links for outreach.
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
