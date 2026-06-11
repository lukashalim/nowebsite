import Link from "next/link";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { cityPath, formatLocationLabel } from "@/lib/directory/labels";
import { directoryCityHeadingLinkClass } from "@/lib/directory/ui-classes";
import type { DirectoryCityGroup } from "@/lib/directory/types";

interface DirectoryGroupedByCityProps {
  cityGroups: DirectoryCityGroup[];
  publishedCitySlugs?: Set<string>;
  getCityHref?: (group: DirectoryCityGroup) => string;
  isCityPublished?: (group: DirectoryCityGroup) => boolean;
}

export function DirectoryGroupedByCity({
  cityGroups,
  publishedCitySlugs,
  getCityHref,
  isCityPublished,
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
            <DirectoryBusinessList businesses={group.businesses} />
          </section>
        );
      })}
    </div>
  );
}
