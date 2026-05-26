import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import {
  fetchGbCountryLanding,
  gbCityHref,
  gbRegionHref,
} from "@/lib/directory/gb-data";
import {
  formatLocationLabel,
  gbCountryHubMetaDescription,
  gbCountryHubMetaTitle,
  gbCountryHubTitle,
  gbCountryPath,
} from "@/lib/directory/labels";
import { COUNTRY_GB } from "@/lib/directory/country";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const landing = await fetchGbCountryLanding();
    return {
      title: { absolute: gbCountryHubMetaTitle() },
      description: gbCountryHubMetaDescription(
        landing.listingCount,
        landing.cities.length,
        landing.lastUpdatedLabel,
      ),
      alternates: { canonical: absoluteUrl(gbCountryPath()) },
    };
  } catch {
    return {
      title: { absolute: gbCountryHubMetaTitle() },
      alternates: { canonical: absoluteUrl(gbCountryPath()) },
    };
  }
}

export default async function UnitedKingdomDirectoryPage() {
  let landing: Awaited<ReturnType<typeof fetchGbCountryLanding>> | null = null;
  let loadError: string | null = null;

  try {
    landing = await fetchGbCountryLanding();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load UK directory.";
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
          {gbCountryHubTitle()}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Local businesses in the United Kingdom whose Google Maps listing has no
          standalone website. Browse by region and city; each listing includes
          ratings, phone numbers, and Maps links.
          {landing && landing.listingCount > 0
            ? ` ${landing.listingCount.toLocaleString()} UK listings in the database.`
            : null}
        </p>
      </header>

      <DirectoryLastUpdated label={landing?.lastUpdatedLabel ?? null} />

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : landing ? (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Regions
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {landing.regions.map((r) => (
                <li key={r.regionSlug}>
                  <Link
                    href={gbRegionHref(r)}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {r.region}
                    </span>
                    <span className="tabular-nums text-zinc-500">
                      {r.listingCount.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {landing.regionCityGroups.map((group) => (
            <section key={group.regionSlug} className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <Link href={gbRegionHref({ regionSlug: group.regionSlug, region: group.region, listingCount: 0, lastModifiedAt: null })} className="hover:underline">
                  {group.region}
                </Link>
              </h2>
              {group.cities.length === 0 ? (
                <p className="text-sm text-zinc-500">No city hubs in this region yet.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.cities.map((c) => (
                    <li key={`${c.regionSlug}-${c.citySlug}`}>
                      <Link
                        href={gbCityHref(c)}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                      >
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {formatLocationLabel(
                            c.city,
                            c.state,
                            COUNTRY_GB,
                            c.region,
                          )}
                        </span>
                        <span className="tabular-nums text-zinc-500">
                          {c.listingCount.toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}
