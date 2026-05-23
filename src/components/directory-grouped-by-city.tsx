import Link from "next/link";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { cityPath, formatCityState } from "@/lib/directory/labels";
import type { DirectoryCityGroup } from "@/lib/directory/types";

interface DirectoryGroupedByCityProps {
  cityGroups: DirectoryCityGroup[];
  publishedCitySlugs?: Set<string>;
}

export function DirectoryGroupedByCity({
  cityGroups,
  publishedCitySlugs,
}: DirectoryGroupedByCityProps) {
  if (cityGroups.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">No listings found.</p>
    );
  }

  return (
    <div className="space-y-10">
      {cityGroups.map((group) => {
        const heading = formatCityState(group.city, group.state);
        const isPublished = publishedCitySlugs?.has(group.citySlug) ?? false;

        return (
          <section key={group.citySlug} className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {isPublished ? (
                <Link
                  href={cityPath(group.citySlug)}
                  className="hover:underline"
                >
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
