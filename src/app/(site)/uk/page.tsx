import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import {
  fetchUkCities,
  fetchUkDirectoryIndex,
  fetchUkListingCount,
} from "@/lib/directory/data";
import {
  cityPath,
  formatLastUpdatedMonthYear,
  formatLocationLabel,
  ukHubTitle,
} from "@/lib/directory/labels";
import { UK_REGION_SLUG_TO_NAME } from "@/lib/directory/country";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  let lastUpdatedLabel: string | null = null;
  try {
    const { lastModified } = await fetchUkDirectoryIndex();
    lastUpdatedLabel = formatLastUpdatedMonthYear(lastModified?.toISOString());
  } catch {
    // omit freshness when unavailable
  }
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  return {
    title: { absolute: `${ukHubTitle()} | No Website Business Leads` },
    description: `Browse UK local businesses without their own website — by city and nation (England, Scotland, Wales, Northern Ireland).${updated}`,
    alternates: { canonical: absoluteUrl("/uk") },
  };
}

export default async function UkDirectoryPage() {
  let cities: Awaited<ReturnType<typeof fetchUkCities>> = [];
  let regions: Awaited<ReturnType<typeof fetchUkDirectoryIndex>>["regions"] = [];
  let totalCount = 0;
  let lastUpdatedLabel: string | null = null;
  let loadError: string | null = null;

  try {
    const [ukIndex, count] = await Promise.all([
      fetchUkDirectoryIndex(),
      fetchUkListingCount(),
    ]);
    cities = ukIndex.cities;
    regions = ukIndex.regions;
    totalCount = count;
    const { formatLastUpdatedMonthYear } = await import("@/lib/directory/labels");
    lastUpdatedLabel = formatLastUpdatedMonthYear(
      ukIndex.lastModified?.toISOString(),
    );
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
          {ukHubTitle()}
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Local businesses in the United Kingdom whose Google Maps listing has no
          standalone website — sourced from Google Maps Extractor NDJSON. Browse by
          nation or city; each listing includes ratings, phones, and Maps links.
          {totalCount > 0
            ? ` ${totalCount.toLocaleString()} UK listings in the database.`
            : null}
        </p>
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Nations
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {Object.entries(UK_REGION_SLUG_TO_NAME).map(([slug, name]) => {
                const ref = regions.find((r) => r.regionSlug === slug);
                return (
                  <li key={slug}>
                    <Link
                      href={`/${slug}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {name}
                      </span>
                      <span className="tabular-nums text-zinc-500">
                        {ref ? ref.listingCount.toLocaleString() : "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Cities
            </h2>
            {cities.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No UK city hubs yet. Ingest NDJSON with{" "}
                <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                  EXTRACT_LOCAL_COUNTRY=GB
                </code>{" "}
                and ensure listings have city and nation set.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cities.map((c) => (
                  <li key={c.citySlug}>
                    <Link
                      href={cityPath(c.citySlug)}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {formatLocationLabel(c.city, c.state, c.country)}
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
        </>
      )}
    </div>
  );
}
