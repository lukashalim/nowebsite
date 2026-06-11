import { cache } from "react";
import { formatLastUpdatedMonthYear } from "@/lib/directory/labels";
import {
  COUNTRY_GB,
  parseDirectoryCountry,
  ukRegionNameToSlug,
} from "@/lib/directory/country";
import {
  type GbIndexBucket,
  bumpFreshnessIsoFromCandidate,
  fetchDirectoryGbListingTotal,
  fetchGbIndexBuckets,
} from "@/lib/directory/aggregate-queries";
import { sortCategoriesByPriority } from "@/lib/directory/category-priority";
import {
  fetchAllNoWebsiteRows,
  groupBusinessesByCity,
  maxFreshnessIso,
  rowToBusiness,
  sortByReviewsDesc,
} from "@/lib/directory/rows";
import {
  categoryMatchesSlug,
  cityNameToSlug,
  directoryCategoryLabel,
  resolveCategoryForRow,
} from "@/lib/directory/slugs";
import type {
  DirectoryBusiness,
  DirectoryCategoryRef,
  DirectoryCityCategoryRef,
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
  cityCategoriesAll: DirectoryCityCategoryRef[];
  publishedCitySlugs: Set<string>;
  lastModified: Date | null;
}

function gbCityKey(regionSlug: string, citySlug: string): string {
  return `${regionSlug}::${citySlug}`;
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

function rowRegionCode(row: {
  region_code?: string | null;
  state?: string | null;
}): string | null {
  const code = row.region_code?.trim().toLowerCase();
  if (code) return code;
  return ukRegionNameToSlug(row.state ?? "");
}

function rowRegionName(row: {
  region?: string | null;
  state?: string | null;
}): string {
  return row.region?.trim() || row.state?.trim() || "";
}

export const fetchGbDirectoryIndex = cache(async (): Promise<GbDirectoryIndex> => {
  const buckets = await fetchGbIndexBuckets();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const regionCounts = new Map<string, DirectoryUkRegionRef>();
  const cityCategoryCounts = new Map<string, DirectoryCityCategoryRef>();
  let lastModifiedIso: string | null = null;

  for (const bucket of buckets) {
    const city = bucket.city;
    const state = bucket.state;
    if (!city || !state) continue;

    const count = bucket.listing_count;
    const bucketFreshness = bucket.last_modified_at;
    lastModifiedIso = bumpFreshnessIsoFromCandidate(
      lastModifiedIso,
      bucketFreshness,
    );

    const regionSlug = rowRegionCode(bucket as GbIndexBucket);
    const region = rowRegionName(bucket);
    if (!regionSlug) continue;

    const citySlug = cityNameToSlug(city);
    if (!citySlug) continue;

    const cityKey = gbCityKey(regionSlug, citySlug);
    const existingCity = cityCounts.get(cityKey);
    if (existingCity) {
      existingCity.listingCount += count;
      existingCity.lastModifiedAt = bumpFreshnessIsoFromCandidate(
        existingCity.lastModifiedAt,
        bucketFreshness,
      );
    } else {
      cityCounts.set(cityKey, {
        citySlug,
        city,
        state,
        region,
        regionSlug,
        country: COUNTRY_GB,
        listingCount: count,
        lastModifiedAt: bucketFreshness,
      });
    }

    const existingRegion = regionCounts.get(regionSlug);
    if (existingRegion) {
      existingRegion.listingCount += count;
      existingRegion.lastModifiedAt = bumpFreshnessIsoFromCandidate(
        existingRegion.lastModifiedAt,
        bucketFreshness,
      );
    } else {
      regionCounts.set(regionSlug, {
        regionSlug,
        region,
        listingCount: count,
        lastModifiedAt: bucketFreshness,
      });
    }

    const resolved = resolveCategoryForRow(
      bucket.main_category,
      bucket.business_type,
    );
    if (resolved) {
      const label = directoryCategoryLabel(
        bucket.main_category,
        bucket.business_type,
      );
      const ccKey = `${cityKey}::${resolved.slug}`;
      const existingCc = cityCategoryCounts.get(ccKey);
      if (existingCc) {
        existingCc.listingCount += count;
        existingCc.lastModifiedAt = bumpFreshnessIsoFromCandidate(
          existingCc.lastModifiedAt,
          bucketFreshness,
        );
      } else {
        cityCategoryCounts.set(ccKey, {
          citySlug,
          categorySlug: resolved.slug,
          city,
          state,
          categoryLabel: label ?? resolved.label,
          listingCount: count,
          lastModifiedAt: bucketFreshness,
        });
      }
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
    cityCategoriesAll: [...cityCategoryCounts.values()],
    publishedCitySlugs: new Set(
      cities.map((c) => gbCityKey(c.regionSlug ?? "", c.citySlug)),
    ),
    lastModified: lastModifiedIso ? new Date(lastModifiedIso) : null,
  };
});

/** @deprecated Use fetchGbDirectoryIndex */
export const fetchUkDirectoryIndex = fetchGbDirectoryIndex;

function rowMatchesGbCity(
  row: Parameters<typeof rowToBusiness>[0],
  regionSlug: string,
  citySlug: string,
): boolean {
  if (parseDirectoryCountry(row.country) !== COUNTRY_GB) return false;
  const code = rowRegionCode(row);
  if (code !== regionSlug.toLowerCase()) return false;
  return cityNameToSlug(row.city ?? "") === citySlug.toLowerCase();
}

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

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter(
    (row) =>
      parseDirectoryCountry(row.country) === COUNTRY_GB &&
      rowRegionCode(row) === regionRef.regionSlug,
  );
  const businesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);
  if (businesses.length < DIRECTORY_MIN_UK_REGION_LISTINGS) return null;

  return {
    region: regionRef.region,
    businesses,
    cityGroups: groupBusinessesByCity(businesses),
    cityCount: new Set(
      matched.map((r) => cityNameToSlug(r.city ?? "")).filter(Boolean),
    ).size,
    listingCount: businesses.length,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
    publishedCitySlugs,
  };
}

export async function fetchGbCityListings(
  citySlug: string,
  regionSlug?: string,
): Promise<DirectoryBusiness[] | null> {
  const cityRef = await resolveGbCityRef(citySlug, regionSlug);
  if (!cityRef?.regionSlug) return null;

  const rows = await fetchAllNoWebsiteRows();
  return rows
    .filter((row) =>
      rowMatchesGbCity(row, cityRef.regionSlug!, cityRef.citySlug),
    )
    .map(rowToBusiness)
    .sort(sortByReviewsDesc);
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

  const index = await fetchGbDirectoryIndex();
  const allCityCategories = index.cityCategoriesAll.filter((c) => {
    const cRegion = ukRegionNameToSlug(c.state);
    return (
      c.citySlug === cityRef.citySlug && cRegion === cityRef.regionSlug
    );
  });

  const categories: DirectoryCategoryRef[] = sortCategoriesByPriority(
    allCityCategories.map((m) => ({
      categorySlug: m.categorySlug,
      categoryLabel: m.categoryLabel,
      listingCount: m.listingCount,
    })),
  );

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

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter(
    (row) =>
      rowMatchesGbCity(row, cityRef.regionSlug!, cityRef.citySlug) &&
      categoryMatchesSlug(row.main_category, row.business_type, slug),
  );
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

