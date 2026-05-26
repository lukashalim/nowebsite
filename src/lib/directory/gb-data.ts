import { cache } from "react";
import { formatLastUpdatedMonthYear } from "@/lib/directory/labels";
import {
  COUNTRY_GB,
  parseDirectoryCountry,
  ukRegionNameToSlug,
} from "@/lib/directory/country";
import {
  bumpFreshnessIso,
  fetchAllNoWebsiteRows,
  groupBusinessesByCity,
  maxFreshnessIso,
  rowToBusiness,
  sortByReviewsDesc,
} from "@/lib/directory/rows";
import { sortCategoriesByPriority } from "@/lib/directory/category-priority";
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
import { gbCityCategoryPath, gbCityPath, gbRegionPath } from "@/lib/directory/paths";

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
  const rows = await fetchAllNoWebsiteRows();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const regionCounts = new Map<string, DirectoryUkRegionRef>();
  const cityCategoryCounts = new Map<string, DirectoryCityCategoryRef>();
  let lastModifiedIso: string | null = null;

  for (const row of rows) {
    if (parseDirectoryCountry(row.country) !== COUNTRY_GB) continue;
    const city = row.city?.trim();
    const state = row.state?.trim();
    if (!city || !state) continue;

    const regionSlug = rowRegionCode(row);
    const region = rowRegionName(row);
    if (!regionSlug) continue;

    lastModifiedIso = bumpFreshnessIso(lastModifiedIso, row);

    const citySlug = cityNameToSlug(city);
    if (!citySlug) continue;

    const cityKey = gbCityKey(regionSlug, citySlug);
    const existingCity = cityCounts.get(cityKey);
    if (existingCity) {
      existingCity.listingCount += 1;
      existingCity.lastModifiedAt = bumpFreshnessIso(
        existingCity.lastModifiedAt,
        row,
      );
    } else {
      cityCounts.set(cityKey, {
        citySlug,
        city,
        state,
        region,
        regionSlug,
        country: COUNTRY_GB,
        listingCount: 1,
        lastModifiedAt: bumpFreshnessIso(null, row),
      });
    }

    const existingRegion = regionCounts.get(regionSlug);
    if (existingRegion) {
      existingRegion.listingCount += 1;
      existingRegion.lastModifiedAt = bumpFreshnessIso(
        existingRegion.lastModifiedAt,
        row,
      );
    } else {
      regionCounts.set(regionSlug, {
        regionSlug,
        region,
        listingCount: 1,
        lastModifiedAt: bumpFreshnessIso(null, row),
      });
    }

    const resolved = resolveCategoryForRow(
      row.main_category,
      row.business_type,
    );
    if (resolved) {
      const label = directoryCategoryLabel(
        row.main_category,
        row.business_type,
      );
      const ccKey = `${cityKey}::${resolved.slug}`;
      const existingCc = cityCategoryCounts.get(ccKey);
      if (existingCc) {
        existingCc.listingCount += 1;
        existingCc.lastModifiedAt = bumpFreshnessIso(
          existingCc.lastModifiedAt,
          row,
        );
      } else {
        cityCategoryCounts.set(ccKey, {
          citySlug,
          categorySlug: resolved.slug,
          city,
          state,
          categoryLabel: label ?? resolved.label,
          listingCount: 1,
          lastModifiedAt: bumpFreshnessIso(null, row),
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
  const rows = await fetchAllNoWebsiteRows();
  const gbRows = rows.filter((r) => parseDirectoryCountry(r.country) === COUNTRY_GB);
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
    listingCount: gbRows.length,
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
  regionSlug: string,
  citySlug: string,
): Promise<DirectoryBusiness[] | null> {
  const index = await fetchGbDirectoryIndex();
  const key = gbCityKey(regionSlug.toLowerCase(), citySlug.toLowerCase());
  const cityRef = index.cities.find(
    (c) => gbCityKey(c.regionSlug ?? "", c.citySlug) === key,
  );
  if (!cityRef) return null;

  const rows = await fetchAllNoWebsiteRows();
  return rows
    .filter((row) => rowMatchesGbCity(row, regionSlug, citySlug))
    .map(rowToBusiness)
    .sort(sortByReviewsDesc);
}

export async function fetchGbCityHub(
  regionSlug: string,
  citySlug: string,
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
  const index = await fetchGbDirectoryIndex();
  const key = gbCityKey(regionSlug.toLowerCase(), citySlug.toLowerCase());
  const cityRef = index.cities.find(
    (c) => gbCityKey(c.regionSlug ?? "", c.citySlug) === key,
  );
  if (!cityRef || !cityRef.regionSlug) return null;

  const usIndex = await import("@/lib/directory/data").then((m) =>
    m.fetchDirectoryIndex(),
  );

  const allCityCategories = index.cityCategoriesAll.filter((c) => {
    const cRegion = ukRegionNameToSlug(c.state);
    return (
      c.citySlug === citySlug.toLowerCase() && cRegion === cityRef.regionSlug
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
  regionSlug: string,
  citySlug: string,
  categorySlug: string,
): Promise<{
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  listingCount: number;
  lastUpdatedLabel: string | null;
} | null> {
  const slug = categorySlug.trim().toLowerCase();
  const hub = await fetchGbCityHub(regionSlug, citySlug);
  if (!hub) return null;

  const cat = hub.categories.find((c) => c.categorySlug === slug);
  if (!cat || cat.listingCount < 1) return null;

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter(
    (row) =>
      rowMatchesGbCity(row, regionSlug, citySlug) &&
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
  return gbCityPath(city.regionSlug ?? "england", city.citySlug);
}

export function gbRegionHref(region: DirectoryUkRegionRef): string {
  return gbRegionPath(region.regionSlug);
}

export async function fetchUkCities(): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchGbDirectoryIndex();
  return cities;
}

export async function fetchGbListingCount(): Promise<number> {
  const rows = await fetchAllNoWebsiteRows();
  return rows.filter((r) => parseDirectoryCountry(r.country) === COUNTRY_GB)
    .length;
}

/** @deprecated Use fetchGbListingCount */
export const fetchUkListingCount = fetchGbListingCount;

export function gbCityCategoryHref(
  regionSlug: string,
  citySlug: string,
  categorySlug: string,
): string {
  return gbCityCategoryPath(regionSlug, citySlug, categorySlug);
}
