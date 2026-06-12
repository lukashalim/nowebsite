import { cache } from "react";
import { formatLastUpdatedMonthYear } from "@/lib/directory/labels";
import {
  COUNTRY_GB,
  ukRegionNameToSlug,
} from "@/lib/directory/country";
import {
  bumpFreshnessIsoFromCandidate,
  fetchDirectoryGbListingTotal,
  fetchGbCityCategoryIndex,
  fetchGbCityIndex,
  fetchGbRegionIndex,
} from "@/lib/directory/aggregate-queries";
import { gbRegionFilterOr } from "@/lib/directory/gb-scoped-rows";
import { DEFAULT_DIRECTORY_LISTING_FILTERS } from "@/lib/directory/listing-filters";
import { fetchGbRegionFacetOptions } from "@/lib/directory/scoped-facets";
import {
  fetchScopedListingPage,
  fetchScopedUnfilteredCount,
} from "@/lib/directory/scoped-listings";
import { sortCategoriesByPriority } from "@/lib/directory/category-priority";
import {
  groupBusinessesByCity,
  maxFreshnessIso,
  rowToBusiness,
  sortByReviewsDesc,
} from "@/lib/directory/rows";
import {
  cityNameToSlug,
  directoryCategoryLabel,
  resolveCategoryForRow,
} from "@/lib/directory/slugs";
import type {
  DirectoryBusiness,
  DirectoryCategoryRef,
  DirectoryCityGroup,
  DirectoryCityRef,
  DirectoryUkRegionRef,
} from "@/lib/directory/types";
import {
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_GB_CITY_LISTINGS,
  DIRECTORY_MIN_UK_REGION_LISTINGS,
} from "@/lib/directory/types";
import { gbCityPath, gbRegionPath } from "@/lib/directory/paths";

export interface GbDirectoryIndex {
  cities: DirectoryCityRef[];
  regions: DirectoryUkRegionRef[];
  publishedCitySlugs: Set<string>;
  lastModified: Date | null;
}

function gbCityKey(regionSlug: string, citySlug: string): string {
  return `${regionSlug}::${citySlug}`;
}

function indexRowRegionSlug(row: {
  region_code: string | null;
  state: string;
}): string | null {
  const code = row.region_code?.trim().toLowerCase();
  if (code) return code;
  return ukRegionNameToSlug(row.state);
}

function indexRowRegionName(row: {
  region: string | null;
  state: string;
}): string {
  return row.region?.trim() || row.state.trim() || "";
}

/** Resolve a published GB city; prefers highest listing count when slug collides across regions. */
export async function resolveGbCityRef(
  citySlug: string,
  regionSlug?: string,
): Promise<DirectoryCityRef | null> {
  const { cities } = await fetchGbDirectoryIndex();
  const slug = citySlug.trim().toLowerCase();
  if (regionSlug) {
    const key = gbCityKey(regionSlug.toLowerCase(), slug);
    return (
      cities.find((c) => gbCityKey(c.regionSlug ?? "", c.citySlug) === key) ??
      null
    );
  }
  const matches = cities.filter((c) => c.citySlug === slug);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.listingCount - a.listingCount)[0]!;
}

export const fetchGbDirectoryIndex = cache(async (): Promise<GbDirectoryIndex> => {
  const [cityRows, regionRows] = await Promise.all([
    fetchGbCityIndex(0),
    fetchGbRegionIndex(0),
  ]);

  const cityCounts = new Map<string, DirectoryCityRef>();
  let lastModifiedIso: string | null = null;

  for (const row of cityRows) {
    const regionSlug = indexRowRegionSlug(row);
    if (!regionSlug) continue;

    const citySlug = cityNameToSlug(row.city);
    if (!citySlug) continue;

    const cityKey = gbCityKey(regionSlug, citySlug);
    const region = indexRowRegionName(row);
    lastModifiedIso = bumpFreshnessIsoFromCandidate(
      lastModifiedIso,
      row.last_modified_at,
    );

    const existingCity = cityCounts.get(cityKey);
    if (existingCity) {
      existingCity.listingCount += row.listing_count;
      existingCity.lastModifiedAt = bumpFreshnessIsoFromCandidate(
        existingCity.lastModifiedAt,
        row.last_modified_at,
      );
    } else {
      cityCounts.set(cityKey, {
        citySlug,
        city: row.city,
        state: row.state,
        region,
        regionSlug,
        country: COUNTRY_GB,
        listingCount: row.listing_count,
        lastModifiedAt: row.last_modified_at,
      });
    }
  }

  const regionCounts = new Map<string, DirectoryUkRegionRef>();

  for (const row of regionRows) {
    const regionSlug = indexRowRegionSlug(row);
    if (!regionSlug) continue;

    const region = indexRowRegionName(row);
    lastModifiedIso = bumpFreshnessIsoFromCandidate(
      lastModifiedIso,
      row.last_modified_at,
    );

    const existingRegion = regionCounts.get(regionSlug);
    if (existingRegion) {
      existingRegion.listingCount += row.listing_count;
      existingRegion.lastModifiedAt = bumpFreshnessIsoFromCandidate(
        existingRegion.lastModifiedAt,
        row.last_modified_at,
      );
    } else {
      regionCounts.set(regionSlug, {
        regionSlug,
        region,
        listingCount: row.listing_count,
        lastModifiedAt: row.last_modified_at,
      });
    }
  }

  const cities = [...cityCounts.values()]
    .filter((c) => c.listingCount >= DIRECTORY_MIN_GB_CITY_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  const regions = [...regionCounts.values()]
    .filter((r) => r.listingCount >= DIRECTORY_MIN_UK_REGION_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  return {
    cities,
    regions,
    publishedCitySlugs: new Set(
      cities.map((c) => gbCityKey(c.regionSlug ?? "", c.citySlug)),
    ),
    lastModified: lastModifiedIso ? new Date(lastModifiedIso) : null,
  };
});

/** @deprecated Use fetchGbDirectoryIndex */
export const fetchUkDirectoryIndex = fetchGbDirectoryIndex;

export async function fetchGbCountryLanding(): Promise<{
  cities: DirectoryCityRef[];
  regions: DirectoryUkRegionRef[];
  regionCityGroups: { region: string; regionSlug: string; cities: DirectoryCityRef[] }[];
  listingCount: number;
  lastUpdatedLabel: string | null;
}> {
  const listingCount = await fetchDirectoryGbListingTotal();
  const { cities, regions, lastModified } = await fetchGbDirectoryIndex();

  const byRegion = new Map<string, DirectoryCityRef[]>();
  for (const c of cities) {
    const rs = c.regionSlug ?? "";
    const list = byRegion.get(rs) ?? [];
    list.push(c);
    byRegion.set(rs, list);
  }

  const regionCityGroups = regions
    .map((r) => ({
      region: r.region,
      regionSlug: r.regionSlug,
      cities: (byRegion.get(r.regionSlug) ?? []).sort(
        (a, b) => b.listingCount - a.listingCount,
      ),
    }))
    .filter((g) => g.cities.length > 0);

  return {
    cities,
    regions,
    regionCityGroups,
    listingCount,
    lastUpdatedLabel: formatLastUpdatedMonthYear(lastModified?.toISOString()),
  };
}

export async function fetchGbRegionListings(regionSlug: string): Promise<{
  region: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  listingCount: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs: Set<string>;
} | null> {
  const { regions, publishedCitySlugs } = await fetchGbDirectoryIndex();
  const regionRef = regions.find((r) => r.regionSlug === regionSlug.toLowerCase());
  if (!regionRef) return null;

  const regionFilter = gbRegionFilterOr(regionRef.regionSlug);
  if (!regionFilter) return null;

  const scope = {
    kind: "gb_region" as const,
    regionSlug: regionRef.regionSlug,
    regionFilter,
  };

  const unfilteredCount = await fetchScopedUnfilteredCount(scope);
  if (unfilteredCount < DIRECTORY_MIN_UK_REGION_LISTINGS) return null;

  const [{ rows }, facetOptions] = await Promise.all([
    fetchScopedListingPage(scope, {
      page: 1,
      pageSize: Math.max(unfilteredCount, 1),
      filters: DEFAULT_DIRECTORY_LISTING_FILTERS,
    }),
    fetchGbRegionFacetOptions(regionRef.regionSlug),
  ]);

  const businesses = rows.map(rowToBusiness).sort(sortByReviewsDesc);

  return {
    region: regionRef.region,
    businesses,
    cityGroups: groupBusinessesByCity(businesses),
    cityCount: facetOptions.cities.length,
    listingCount: businesses.length,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(rows)),
    publishedCitySlugs,
  };
}

export async function fetchGbCityListings(
  citySlug: string,
  regionSlug?: string,
): Promise<DirectoryBusiness[] | null> {
  const cityRef = await resolveGbCityRef(citySlug, regionSlug);
  if (!cityRef?.regionSlug) return null;

  const regionFilter = gbRegionFilterOr(cityRef.regionSlug);
  if (!regionFilter) return null;

  const scope = {
    kind: "gb_city" as const,
    city: cityRef.city,
    regionSlug: cityRef.regionSlug,
    regionFilter,
  };

  const unfilteredCount = await fetchScopedUnfilteredCount(scope);
  if (unfilteredCount === 0) return null;

  const { rows } = await fetchScopedListingPage(scope, {
    page: 1,
    pageSize: Math.max(unfilteredCount, 1),
    filters: DEFAULT_DIRECTORY_LISTING_FILTERS,
  });

  return rows.map(rowToBusiness).sort(sortByReviewsDesc);
}

function mergeGbCityCategoryRows(
  rows: Awaited<ReturnType<typeof fetchGbCityCategoryIndex>>,
): DirectoryCategoryRef[] {
  const categoryCounts = new Map<string, DirectoryCategoryRef>();

  for (const row of rows) {
    const resolved = resolveCategoryForRow(row.main_category, row.business_type);
    if (!resolved) continue;

    const label = directoryCategoryLabel(row.main_category, row.business_type);
    const existing = categoryCounts.get(resolved.slug);
    if (existing) {
      existing.listingCount += row.listing_count;
    } else {
      categoryCounts.set(resolved.slug, {
        categorySlug: resolved.slug,
        categoryLabel: label ?? resolved.label,
        listingCount: row.listing_count,
      });
    }
  }

  return sortCategoriesByPriority([...categoryCounts.values()]);
}

export async function fetchGbCityHub(
  citySlug: string,
  regionSlug?: string,
): Promise<{
  city: string;
  state: string;
  region: string;
  regionSlug: string;
  listingCount: number;
  categories: DirectoryCategoryRef[];
  publishedCategories: DirectoryCategoryRef[];
  lastUpdatedLabel: string | null;
} | null> {
  const cityRef = await resolveGbCityRef(citySlug, regionSlug);
  if (!cityRef?.regionSlug) return null;

  const usIndex = await import("@/lib/directory/data").then((m) =>
    m.fetchDirectoryIndex(),
  );

  const cityCategoryRows = await fetchGbCityCategoryIndex(
    cityRef.city,
    cityRef.regionSlug,
  );
  const categories = mergeGbCityCategoryRows(cityCategoryRows);

  const publishedCategorySlugs = new Set(
    usIndex.categories
      .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
      .map((c) => c.categorySlug),
  );
  const publishedCategories = categories.filter((c) =>
    publishedCategorySlugs.has(c.categorySlug),
  );

  return {
    city: cityRef.city,
    state: cityRef.state,
    region: cityRef.region ?? cityRef.state,
    regionSlug: cityRef.regionSlug,
    listingCount: cityRef.listingCount,
    categories,
    publishedCategories,
    lastUpdatedLabel: formatLastUpdatedMonthYear(cityRef.lastModifiedAt),
  };
}

export async function fetchGbCityCategoryListings(
  citySlug: string,
  categorySlug: string,
  regionSlug?: string,
): Promise<{
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  listingCount: number;
  lastUpdatedLabel: string | null;
} | null> {
  const slug = categorySlug.trim().toLowerCase();
  const cityRef = await resolveGbCityRef(citySlug, regionSlug);
  if (!cityRef?.regionSlug) return null;

  const hub = await fetchGbCityHub(cityRef.citySlug, cityRef.regionSlug);
  if (!hub) return null;

  const cat = hub.categories.find((c) => c.categorySlug === slug);
  if (!cat || cat.listingCount < 1) return null;

  const regionFilter = gbRegionFilterOr(cityRef.regionSlug);
  if (!regionFilter) return null;

  const scope = {
    kind: "gb_city_category" as const,
    city: cityRef.city,
    regionSlug: cityRef.regionSlug,
    regionFilter,
    categorySlug: slug,
  };

  const unfilteredCount = await fetchScopedUnfilteredCount(scope);
  if (unfilteredCount === 0) return null;

  const { rows: matched } = await fetchScopedListingPage(scope, {
    page: 1,
    pageSize: Math.max(unfilteredCount, 1),
    filters: DEFAULT_DIRECTORY_LISTING_FILTERS,
  });
  const businesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);
  if (businesses.length === 0) return null;

  return {
    categoryLabel: cat.categoryLabel,
    businesses,
    listingCount: businesses.length,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
  };
}

export function gbCityHref(city: DirectoryCityRef): string {
  return gbCityPath(city.citySlug);
}

export function gbRegionHref(region: DirectoryUkRegionRef): string {
  return gbRegionPath(region.regionSlug);
}

export async function fetchUkCities(): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchGbDirectoryIndex();
  return cities;
}

export async function fetchGbListingCount(): Promise<number> {
  return fetchDirectoryGbListingTotal();
}

/** @deprecated Use fetchGbListingCount */
export const fetchUkListingCount = fetchGbListingCount;
