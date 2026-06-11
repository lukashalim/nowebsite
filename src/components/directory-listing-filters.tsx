import Link from "next/link";
import { Filter } from "lucide-react";
import {
  DIRECTORY_MIN_REVIEWS_OPTIONS,
  hasActiveDirectoryListingFilters,
  type DirectoryFilterOptions,
  type DirectoryListingFilters,
} from "@/lib/directory/listing-filters";
import { directoryPrimaryButtonClass } from "@/lib/directory/ui-classes";

export type DirectoryListingFiltersMode =
  | "full"
  | "stateFixed"
  | "reviewsOnly";

interface DirectoryListingFiltersProps {
  action: string;
  mode: DirectoryListingFiltersMode;
  filters: DirectoryListingFilters;
  filterOptions: DirectoryFilterOptions;
  unfilteredCount: number;
  totalCount: number;
  fixedStateLabel?: string;
}

export function DirectoryListingFilters({
  action,
  mode,
  filters,
  filterOptions,
  unfilteredCount,
  totalCount,
  fixedStateLabel,
}: DirectoryListingFiltersProps) {
  const cities =
    filters.stateSlug != null
      ? (filterOptions.citiesByStateSlug[filters.stateSlug] ?? [])
      : [];
  const cityDisabled = mode === "reviewsOnly" || !filters.stateSlug;
  const filtered = hasActiveDirectoryListingFilters(filters);

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <Filter className="size-4" aria-hidden />
          Filters
        </div>
        {filtered ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing {totalCount.toLocaleString()} of{" "}
            {unfilteredCount.toLocaleString()} listings
          </p>
        ) : null}
      </div>

      <form method="get" action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mode === "stateFixed" && fixedStateLabel ? (
          <div className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            State
            <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100">
              {fixedStateLabel}
            </span>
          </div>
        ) : mode === "full" ? (
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            State
            <select
              name="state"
              defaultValue={filters.stateSlug ?? ""}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">All states</option>
              {filterOptions.states.map((s) => (
                <option key={s.stateSlug} value={s.stateSlug}>
                  {s.label} ({s.count.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode !== "reviewsOnly" ? (
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            City
            <select
              name="city"
              defaultValue={filters.citySlug ?? ""}
              disabled={cityDisabled}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">
                {cityDisabled ? "Select a state first" : "All cities in state"}
              </option>
              {cities.map((c) => (
                <option key={c.citySlug} value={c.citySlug}>
                  {c.city} ({c.count.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Min reviews
          <select
            name="minReviews"
            defaultValue={String(filters.minReviews)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {DIRECTORY_MIN_REVIEWS_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className={directoryPrimaryButtonClass}>
            Apply
          </button>
          {filtered ? (
            <Link
              href={action}
              className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}
