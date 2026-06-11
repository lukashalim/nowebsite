import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { fetchAllDirectoryCities, fetchDirectoryLastUpdatedLabel } from "@/lib/directory/data";
import { cityPath, formatCityState } from "@/lib/directory/labels";
import { directoryBreadcrumbLinkClass, directoryRowLinkClass } from "@/lib/directory/ui-classes";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  let lastUpdatedLabel: string | null = null;
  try {
    lastUpdatedLabel = await fetchDirectoryLastUpdatedLabel();
  } catch {
    // omit freshness from meta when directory data is unavailable
  }
  const updated = lastUpdatedLabel ? ` Updated ${lastUpdatedLabel}.` : "";
  return {
    title: { absolute: "All cities | Businesses without a website" },
    description: `Browse every city directory of local businesses without their own website — ratings, phones, and Maps links.${updated}`,
    alternates: { canonical: absoluteUrl("/cities") },
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

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/" className={directoryBreadcrumbLinkClass}>
            Home
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          All cities
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Each city page lists every no-website business we have in that market,
          grouped by category where enough listings exist for a dedicated page.
        </p>
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
