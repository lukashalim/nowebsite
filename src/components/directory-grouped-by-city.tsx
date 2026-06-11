import Link from "next/link";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { cityPath, formatLocationLabel } from "@/lib/directory/labels";
import { directoryCityHeadingLinkClass } from "@/lib/directory/ui-classes";
import type { DirectoryCityGroup } from "@/lib/directory/types";
import { createDirectoryContactAccess } from "@/lib/directory/contact-access";
import {
  DEFAULT_DIRECTORY_LISTING_FILTERS,
  type DirectoryListingFilters,
} from "@/lib/directory/listing-filters";
import { listingScopeForCity } from "@/lib/directory/listing-scope";

interface DirectoryGroupedByCityProps {
  cityGroups: DirectoryCityGroup[];
  publishedCitySlugs?: Set<string>;
  getCityHref?: (group: DirectoryCityGroup) => string;
  isCityPublished?: (group: DirectoryCityGroup) => boolean;
  listingFilters?: DirectoryListingFilters;
}

export function DirectoryGroupedByCity({
  cityGroups,
  publishedCitySlugs,
  getCityHref,
  isCityPublished,
  listingFilters = DEFAULT_DIRECTORY_LISTING_FILTERS,
}: DirectoryGroupedByCityProps) {
  if (cityGroups.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">No listings found.</p>
    );
  }

  return (
    <div className="space-y-10">
      {cityGroups.map((group) => {
        const heading = formatLocationLabel(
          group.city,
          group.state,
          group.country,
          group.region,
        );
        const isPublished = isCityPublished
          ? isCityPublished(group)
          : (publishedCitySlugs?.has(group.citySlug) ?? false);
        const href = getCityHref ? getCityHref(group) : cityPath(group.citySlug);
        const contactAccess = createDirectoryContactAccess(
          listingScopeForCity(group.citySlug),
          1,
          listingFilters,
        );

        return (
          <section key={group.citySlug} className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {isPublished ? (
                <Link href={href} className={directoryCityHeadingLinkClass}>
                  {heading}
                </Link>
              ) : (
                heading
              )}
              <span className="ml-2 text-sm font-normal tabular-nums text-zinc-500">
                ({group.businesses.length.toLocaleString()})
              </span>
            </h2>
            <DirectoryBusinessList
              businesses={group.businesses}
              contactAccess={contactAccess}
            />
          </section>
        );
      })}
    </div>
  );
}
