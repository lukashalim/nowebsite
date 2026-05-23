import type { Metadata } from "next";
import Link from "next/link";
import { fetchAllDirectoryCities } from "@/lib/directory/data";
import { cityPath, formatCityState } from "@/lib/directory/labels";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "All cities | Businesses without a website" },
  description:
    "Browse every city directory of local businesses without their own website — ratings, phones, and Maps links.",
  alternates: { canonical: absoluteUrl("/cities") },
};

export default async function CitiesIndexPage() {
  let cities: Awaited<ReturnType<typeof fetchAllDirectoryCities>> = [];
  let loadError: string | null = null;

  try {
    cities = await fetchAllDirectoryCities();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load cities.";
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
          All cities
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Each city page lists every no-website business we have in that market,
          grouped by category where enough listings exist for a dedicated page.
        </p>
      </header>

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
              <Link
                href={cityPath(c.citySlug)}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
              >
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
