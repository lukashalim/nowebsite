import { COUNTRY_US } from "@/lib/directory/country";
import type { DirectoryBusiness } from "@/lib/directory/types";
import {
  cityStateToSlug,
  parseStateSlug,
  stateAbbrToDisplayName,
  stateNameToSlug,
  stateToAbbr,
} from "@/lib/directory/slugs";

export const DIRECTORY_MIN_REVIEWS_OPTIONS = [0, 10, 25, 50, 100] as const;

export type DirectoryMinReviewsOption =
  (typeof DIRECTORY_MIN_REVIEWS_OPTIONS)[number];

export interface DirectoryListingFilters {
  stateSlug: string | null;
  citySlug: string | null;
  minReviews: DirectoryMinReviewsOption;
}

export const DEFAULT_DIRECTORY_LISTING_FILTERS: DirectoryListingFilters = {
  stateSlug: null,
  citySlug: null,
  minReviews: 0,
};

export interface DirectoryFilterStateOption {
  stateSlug: string;
  label: string;
  count: number;
}

export interface DirectoryFilterCityOption {
  citySlug: string;
  city: string;
  count: number;
}

export interface DirectoryFilterOptions {
  states: DirectoryFilterStateOption[];
  citiesByStateSlug: Record<string, DirectoryFilterCityOption[]>;
}

function firstParam(
  raw: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function parseMinReviews(raw: string | undefined): DirectoryMinReviewsOption {
  if (!raw?.trim()) return 0;
  const n = Number.parseInt(raw.trim(), 10);
  if (
    DIRECTORY_MIN_REVIEWS_OPTIONS.includes(n as DirectoryMinReviewsOption)
  ) {
    return n as DirectoryMinReviewsOption;
  }
  return 0;
}

export function parseDirectoryListingFilters(
  searchParams: Record<string, string | string[] | undefined>,
): DirectoryListingFilters {
  const stateRaw = firstParam(searchParams.state)?.trim().toLowerCase();
  const cityRaw = firstParam(searchParams.city)?.trim().toLowerCase();
  const minReviews = parseMinReviews(firstParam(searchParams.minReviews));

  return {
    stateSlug: stateRaw || null,
    citySlug: cityRaw || null,
    minReviews,
  };
}

export function hasActiveDirectoryListingFilters(
  filters: DirectoryListingFilters,
): boolean {
  return (
    filters.stateSlug != null ||
    filters.citySlug != null ||
    filters.minReviews > 0
  );
}

export function buildDirectoryFilterOptions(
  businesses: DirectoryBusiness[],
): DirectoryFilterOptions {
  const stateCounts = new Map<
    string,
    { label: string; count: number }
  >();
  const cityCounts = new Map<
    string,
    Map<string, { city: string; count: number }>
  >();

  for (const b of businesses) {
    if (b.country !== COUNTRY_US) continue;
    const city = b.city?.trim();
    const state = b.state?.trim();
    if (!city || !state) continue;

    const stateSlug = stateNameToSlug(state);
    if (!stateSlug) continue;

    const citySlug = cityStateToSlug(city, state, b.country);
    if (!citySlug) continue;

    const stateEntry = stateCounts.get(stateSlug);
    if (stateEntry) {
      stateEntry.count += 1;
    } else {
      stateCounts.set(stateSlug, {
        label: stateAbbrToDisplayName(stateToAbbr(state) ?? state),
        count: 1,
      });
    }

    let byCity = cityCounts.get(stateSlug);
    if (!byCity) {
      byCity = new Map();
      cityCounts.set(stateSlug, byCity);
    }
    const cityEntry = byCity.get(citySlug);
    if (cityEntry) {
      cityEntry.count += 1;
    } else {
      byCity.set(citySlug, { city, count: 1 });
    }
  }

  const states = [...stateCounts.entries()]
    .map(([stateSlug, { label, count }]) => ({ stateSlug, label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const citiesByStateSlug: Record<string, DirectoryFilterCityOption[]> = {};
  for (const [stateSlug, cities] of cityCounts) {
    citiesByStateSlug[stateSlug] = [...cities.entries()]
      .map(([citySlug, { city, count }]) => ({ citySlug, city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
  }

  return { states, citiesByStateSlug };
}

export function sanitizeDirectoryListingFilters(
  filters: DirectoryListingFilters,
  options: DirectoryFilterOptions,
  opts?: {
    mode?: "full" | "stateFixed" | "reviewsOnly";
    fixedStateSlug?: string | null;
  },
): DirectoryListingFilters {
  const mode = opts?.mode ?? "full";
  let stateSlug = filters.stateSlug;

  if (mode === "stateFixed" && opts?.fixedStateSlug) {
    stateSlug = opts.fixedStateSlug;
  } else if (mode === "reviewsOnly") {
    stateSlug = null;
  } else if (stateSlug && !options.states.some((s) => s.stateSlug === stateSlug)) {
    stateSlug = null;
  }

  let citySlug = filters.citySlug;
  if (mode === "reviewsOnly" || !stateSlug) {
    citySlug = null;
  } else {
    const cities = options.citiesByStateSlug[stateSlug] ?? [];
    if (!cities.some((c) => c.citySlug === citySlug)) {
      citySlug = null;
    }
  }

  return {
    stateSlug,
    citySlug,
    minReviews: filters.minReviews,
  };
}

export function applyDirectoryListingFilters(
  businesses: DirectoryBusiness[],
  filters: DirectoryListingFilters,
): DirectoryBusiness[] {
  return businesses.filter((b) => {
    const reviews = b.reviews ?? 0;
    if (reviews < filters.minReviews) return false;

    if (filters.stateSlug) {
      const parsed = parseStateSlug(filters.stateSlug);
      if (!parsed) return false;
      const abbr = stateToAbbr(b.state ?? "");
      if (!abbr || abbr !== parsed.stateAbbr) return false;
    }

    if (filters.citySlug) {
      const city = b.city?.trim();
      const state = b.state?.trim();
      if (!city || !state) return false;
      const slug = cityStateToSlug(city, state, b.country);
      if (slug !== filters.citySlug) return false;
    }

    return true;
  });
}

export function directoryListingPathWithQuery(
  path: string,
  opts?: { page?: number; filters?: DirectoryListingFilters },
): string {
  const base = path.trim() || "/";
  const params = new URLSearchParams();
  const filters = opts?.filters;

  if (filters?.stateSlug) params.set("state", filters.stateSlug);
  if (filters?.citySlug) params.set("city", filters.citySlug);
  if (filters && filters.minReviews > 0) {
    params.set("minReviews", String(filters.minReviews));
  }

  const page = opts?.page ?? 1;
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
