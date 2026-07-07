import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryBreadcrumbs } from "@/components/directory-breadcrumbs";
import { DirectoryHubNav } from "@/components/directory-hub-nav";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { fetchAllDirectoryCities, fetchDirectoryLastUpdatedLabel } from "@/lib/directory/data";
import { cityPath, formatCityState } from "@/lib/directory/labels";
import { directoryRowLinkClass } from "@/lib/directory/ui-classes";
import { absoluteUrl } from "@/lib/site-url";
import { directoryOpenGraph } from "@/lib/site-metadata";

export const revalidate = 3600;

const TOP_CITY_LINKS = 10;

export async function generateMetadata(): Promise<Metadata> {
  let lastUpdatedLabel: string | null = null;
  try {
    lastUpdatedLabel = await fetchDirectoryLastUpdatedLabel();
  } catch {
    // omit freshness from meta when directory data is unavailable
  }
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  const title = "Businesses Without a Website by City | Near-You Lead Lists";
  const description = `Browse city-level lists of businesses without a website near you — B2B prospecting data for web design agencies.${updated}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl("/cities") },
    ...directoryOpenGraph({ title, description, path: "/cities" }),
  };
}

export default async function CitiesIndexPage() {
  let cities: Awaited<ReturnType<typeof fetchAllDirectoryCities>> = [];
  let lastUpdatedLabel: string | null = null;
  let loadError: string | null = null;

  try {
    [cities, lastUpdatedLabel] = await Promise.all([
      fetchAllDirectoryCities(),
      fetchDirectoryLastUpdatedLabel(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load cities.";
  }

  const featuredCities = cities.slice(0, TOP_CITY_LINKS);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <DirectoryBreadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "All cities" }]}
          pagePath="/cities"
        />
        <DirectoryHubNav active="cities" />
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Businesses Without a Website by City
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Pick your city for businesses without a website near you — or browse
          businesses without a website near me in major markets. Each city page
          lists every no-website business we have in that market, grouped by
          category where enough listings exist for a dedicated page.
        </p>
        {featuredCities.length > 0 ? (
          <ul className="flex flex-wrap gap-2 pt-1">
            {featuredCities.map((c) => (
              <li key={c.citySlug}>
                <Link
                  href={cityPath(c.citySlug)}
                  className="inline-flex rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900/50"
                >
                  Businesses without a website in {formatCityState(c.city, c.state)}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : cities.length === 0 ? (
        <p className="text-sm text-zinc-500">No city directories yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <li key={c.citySlug}>
              <Link href={cityPath(c.citySlug)} className={directoryRowLinkClass}>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCityState(c.city, c.state)}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {c.listingCount.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
