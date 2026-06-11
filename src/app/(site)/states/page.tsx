import type { Metadata } from "next";
import Link from "next/link";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import {
  fetchAllDirectoryStates,
  fetchDirectoryLastUpdatedLabel,
} from "@/lib/directory/data";
import { statePath } from "@/lib/directory/labels";
import { directoryBreadcrumbLinkClass, directoryRowLinkClass } from "@/lib/directory/ui-classes";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";
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
    title: { absolute: "All states | Businesses without a website" },
    description: `Browse every state directory of local businesses without their own website — grouped by city with ratings, phones, and Maps links.${updated}`,
    alternates: { canonical: absoluteUrl("/states") },
  };
}

export default async function StatesIndexPage() {
  let states: Awaited<ReturnType<typeof fetchAllDirectoryStates>> = [];
  let lastUpdatedLabel: string | null = null;
  let loadError: string | null = null;

  try {
    [states, lastUpdatedLabel] = await Promise.all([
      fetchAllDirectoryStates(),
      fetchDirectoryLastUpdatedLabel(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load states.";
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
          All states
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Each state page lists no-website businesses statewide, grouped by city,
          with ratings, phones, and Google Maps links.
        </p>
      </header>

      <DirectoryLastUpdated label={lastUpdatedLabel} />

      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </p>
      ) : states.length === 0 ? (
        <p className="text-sm text-zinc-500">No state directories yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((s) => (
            <li key={s.stateSlug}>
              <Link href={statePath(s.stateSlug)} className={directoryRowLinkClass}>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {stateAbbrToDisplayName(stateToAbbr(s.state) ?? s.state)}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {s.listingCount.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
