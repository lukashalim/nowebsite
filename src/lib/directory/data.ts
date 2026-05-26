import { cache } from "react";
import { formatLastUpdatedMonthYear } from "@/lib/directory/labels";
import {
  COUNTRY_GB,
  COUNTRY_US,
  parseDirectoryCountry,
  ukRegionMatchesState,
  ukRegionNameToSlug,
} from "@/lib/directory/country";
import {
  categoryMatchesSlug,
  cityStateToSlug,
  directoryCategoryLabel,
  parseCitySlug,
  parseStateSlug,
  resolveCategoryForRow,
  stateNameToSlug,
  stateToAbbr,
} from "@/lib/directory/slugs";
import type {
  DirectoryBusiness,
  DirectoryCategoryRef,
  DirectoryCityCategoryRef,
  DirectoryCityGroup,
  DirectoryCityRef,
  DirectoryCountry,
  DirectoryStateRef,
  DirectoryUkRegionRef,
} from "@/lib/directory/types";
import {
  DIRECTORY_LIST_COLUMNS,
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_CITY_LISTINGS,
  DIRECTORY_MIN_STATE_LISTINGS,
  DIRECTORY_MIN_UK_REGION_LISTINGS,
} from "@/lib/directory/types";
import {
  clampDirectoryPage,
  DIRECTORY_CATEGORY_PAGE_SIZE,
  DIRECTORY_STATE_PAGE_SIZE,
  totalDirectoryPages,
} from "@/lib/directory/pagination";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

interface RawDirectoryRow {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  business_type: string | null;
  main_category: string | null;
  rating: number | null;
  reviews: number | null;
  phone: string | null;
  google_maps_link: string | null;
  demo_slug: string | null;
  last_scraped_at: string | null;
  scraped_at: string | null;
}

function rowToBusiness(row: RawDirectoryRow): DirectoryBusiness {
  return {
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    country: parseDirectoryCountry(row.country),
    business_type: row.business_type,
    main_category: row.main_category,
    rating: row.rating,
    reviews: row.reviews,
    phone: row.phone,
    google_maps_link: row.google_maps_link,
    demo_slug: row.demo_slug,
  };
}

function maxFreshnessIso(
  rows: { last_scraped_at?: string | null; scraped_at?: string | null }[],
): string | null {
  let max: string | null = null;
  for (const row of rows) {
    const t = row.last_scraped_at ?? row.scraped_at;
    if (!t) continue;
    if (!max || t > max) max = t;
  }
  return max;
}

const fetchAllNoWebsiteRows = cache(async (): Promise<RawDirectoryRow[]> => {
  const supabase = createSupabaseAdmin();
  const rows: RawDirectoryRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("businesses_nowebsite")
      .select(DIRECTORY_LIST_COLUMNS)
      .eq("has_website", false)
      .not("city", "is", null)
      .not("state", "is", null)
      .order("reviews", { ascending: false })
      .order("place_id", { ascending: true })
      .range(from, from + BATCH - 1);

    if (error) {
      const hint = /country|schema cache/i.test(error.message)
        ? " Run scrape/sql/add-country-businesses-nowebsite.sql in Supabase."
        : "";
      throw new Error(error.message + hint);
    }
    const batch = (data ?? []) as RawDirectoryRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return rows;
});

const fetchAllFacebookSurfaceRows = cache(async (): Promise<RawDirectoryRow[]> => {
  const supabase = createSupabaseAdmin();
  const rows: RawDirectoryRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("businesses_nowebsite")
      .select(DIRECTORY_LIST_COLUMNS)
      .eq("has_website", false)
      .eq("crm_contact_surface", "facebook")
      .not("city", "is", null)
      .not("state", "is", null)
      .order("reviews", { ascending: false })
      .order("place_id", { ascending: true })
      .range(from, from + BATCH - 1);

    if (error) {
      const hint = /crm_contact_surface|listing_website|schema cache/i.test(
        error.message,
      )
        ? " Run scrape/sql/add-listing-website-crm-contact-surface.sql in Supabase, then refresh."
        : "";
      throw new Error(error.message + hint);
    }
    const batch = (data ?? []) as RawDirectoryRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return rows;
});

export interface FacebookDirectoryPageData {
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  totalCount: number;
  lastUpdatedLabel: string | null;
}

export const fetchFacebookDirectoryPageData = cache(
  async (): Promise<FacebookDirectoryPageData> => {
    const rows = await fetchAllFacebookSurfaceRows();
    const businesses = rows.map(rowToBusiness).sort(sortByReviewsDesc);
    const cityGroups = groupBusinessesByCity(businesses);

    return {
      businesses,
      cityGroups,
      totalCount: businesses.length,
      lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(rows)),
    };
  },
);

function sortByReviewsDesc(a: DirectoryBusiness, b: DirectoryBusiness): number {
  return (b.reviews ?? 0) - (a.reviews ?? 0);
}

function bumpFreshnessIso(
  current: string | null,
  row: Pick<RawDirectoryRow, "last_scraped_at" | "scraped_at">,
): string | null {
  const t = row.last_scraped_at ?? row.scraped_at;
  if (!t) return current;
  if (!current || t > current) return t;
  return current;
}

export function groupBusinessesByCity(
  businesses: DirectoryBusiness[],
): DirectoryCityGroup[] {
  const groups = new Map<string, DirectoryCityGroup>();

  for (const b of businesses) {
    const city = b.city?.trim();
    const state = b.state?.trim();
    if (!city || !state) continue;
    const citySlug = cityStateToSlug(city, state, b.country);
    if (!citySlug) continue;

    const key = citySlug;
    const existing = groups.get(key);
    if (existing) {
      existing.businesses.push(b);
    } else {
      groups.set(key, {
        city,
        state,
        country: b.country,
        citySlug,
        businesses: [b],
      });
    }
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      businesses: g.businesses.sort(sortByReviewsDesc),
    }))
    .sort((a, b) => b.businesses.length - a.businesses.length);
}

export const fetchDirectoryIndex = cache(async (): Promise<{
  cities: DirectoryCityRef[];
  categories: {
    categoryLabel: string;
    categorySlug: string;
    totalCount: number;
    lastModifiedAt: string | null;
  }[];
  states: DirectoryStateRef[];
  cityCategoriesAll: DirectoryCityCategoryRef[];
  publishedCitySlugs: Set<string>;
  homepageLastModified: Date | null;
}> => {
  const rows = await fetchAllNoWebsiteRows();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const categoryCounts = new Map<
    string,
    {
      categoryLabel: string;
      categorySlug: string;
      totalCount: number;
      lastModifiedAt: string | null;
    }
  >();
  const stateCounts = new Map<string, DirectoryStateRef>();
  const cityCategoryCounts = new Map<string, DirectoryCityCategoryRef>();
  let homepageLastModifiedIso: string | null = null;

  for (const row of rows) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    if (!city || !state) continue;

    homepageLastModifiedIso = bumpFreshnessIso(homepageLastModifiedIso, row);

    const country = parseDirectoryCountry(row.country);

    if (country === COUNTRY_US) {
      const citySlug = cityStateToSlug(city, state, COUNTRY_US);
      if (citySlug) {
        const cityKey = citySlug;
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
            country: COUNTRY_US,
            listingCount: 1,
            lastModifiedAt: bumpFreshnessIso(null, row),
          });
        }
      }

      const stateSlug = stateNameToSlug(state);
      const stateAbbr = stateToAbbr(state);
      if (stateSlug && stateAbbr) {
        const stateKey = stateSlug;
        const existingState = stateCounts.get(stateKey);
        if (existingState) {
          existingState.listingCount += 1;
          existingState.lastModifiedAt = bumpFreshnessIso(
            existingState.lastModifiedAt,
            row,
          );
        } else {
          stateCounts.set(stateKey, {
            stateSlug,
            state,
            country: COUNTRY_US,
            listingCount: 1,
            lastModifiedAt: bumpFreshnessIso(null, row),
          });
        }
      }
    }

    const citySlugForCategory =
      cityStateToSlug(city, state, country) ?? cityStateToSlug(city, state, COUNTRY_US);
    if (!citySlugForCategory) continue;

    const resolved = resolveCategoryForRow(
      row.main_category,
      row.business_type,
    );
    if (resolved) {
      const catKey = resolved.slug;
      const label = directoryCategoryLabel(row.main_category, row.business_type);
      const existingCat = categoryCounts.get(catKey);
      if (existingCat) {
        existingCat.totalCount += 1;
        existingCat.lastModifiedAt = bumpFreshnessIso(
          existingCat.lastModifiedAt,
          row,
        );
      } else {
        categoryCounts.set(catKey, {
          categoryLabel: label ?? resolved.label,
          categorySlug: resolved.slug,
          totalCount: 1,
          lastModifiedAt: bumpFreshnessIso(null, row),
        });
      }

      const ccKey = `${citySlugForCategory}::${resolved.slug}`;
      const existingCc = cityCategoryCounts.get(ccKey);
      if (existingCc) {
        existingCc.listingCount += 1;
        existingCc.lastModifiedAt = bumpFreshnessIso(
          existingCc.lastModifiedAt,
          row,
        );
      } else {
        cityCategoryCounts.set(ccKey, {
          citySlug: citySlugForCategory,
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
    .filter((c) => c.listingCount >= DIRECTORY_MIN_CITY_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  const publishedCitySlugs = new Set(cities.map((c) => c.citySlug));

  const categories = [...categoryCounts.values()]
    .filter((c) => c.totalCount > 0)
    .sort((a, b) => b.totalCount - a.totalCount);

  const states = [...stateCounts.values()]
    .filter((s) => s.listingCount >= DIRECTORY_MIN_STATE_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  const homepageLastModified = homepageLastModifiedIso
    ? new Date(homepageLastModifiedIso)
    : null;

  return {
    cities,
    categories,
    states,
    cityCategoriesAll: [...cityCategoryCounts.values()],
    publishedCitySlugs,
    homepageLastModified,
  };
});

export const fetchUkDirectoryIndex = cache(async (): Promise<{
  cities: DirectoryCityRef[];
  regions: DirectoryUkRegionRef[];
  publishedCitySlugs: Set<string>;
  lastModified: Date | null;
}> => {
  const rows = await fetchAllNoWebsiteRows();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const regionCounts = new Map<string, DirectoryUkRegionRef>();
  let lastModifiedIso: string | null = null;

  for (const row of rows) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    if (!city || !state) continue;
    if (parseDirectoryCountry(row.country) !== COUNTRY_GB) continue;

    lastModifiedIso = bumpFreshnessIso(lastModifiedIso, row);

    const citySlug = cityStateToSlug(city, state, COUNTRY_GB);
    if (citySlug) {
      const existingCity = cityCounts.get(citySlug);
      if (existingCity) {
        existingCity.listingCount += 1;
        existingCity.lastModifiedAt = bumpFreshnessIso(
          existingCity.lastModifiedAt,
          row,
        );
      } else {
        cityCounts.set(citySlug, {
          citySlug,
          city,
          state,
          country: COUNTRY_GB,
          listingCount: 1,
          lastModifiedAt: bumpFreshnessIso(null, row),
        });
      }
    }

    const regionSlug = ukRegionNameToSlug(state);
    if (regionSlug) {
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
          region: state,
          listingCount: 1,
          lastModifiedAt: bumpFreshnessIso(null, row),
        });
      }
    }
  }

  const cities = [...cityCounts.values()]
    .filter((c) => c.listingCount >= DIRECTORY_MIN_CITY_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  const regions = [...regionCounts.values()]
    .filter((r) => r.listingCount >= DIRECTORY_MIN_UK_REGION_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  return {
    cities,
    regions,
    publishedCitySlugs: new Set(cities.map((c) => c.citySlug)),
    lastModified: lastModifiedIso ? new Date(lastModifiedIso) : null,
  };
});

export async function fetchUkCities(): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchUkDirectoryIndex();
  return cities;
}

export async function fetchUkListingCount(): Promise<number> {
  const rows = await fetchAllNoWebsiteRows();
  return rows.filter((r) => parseDirectoryCountry(r.country) === COUNTRY_GB)
    .length;
}

function rowMatchesCitySlug(row: RawDirectoryRow, citySlug: string): boolean {
  const parsed = parseCitySlug(citySlug);
  if (!parsed) return false;
  const country = parseDirectoryCountry(row.country);
  if (parsed.country !== country) return false;
  return (
    cityStateToSlug(row.city ?? "", row.state ?? "", country) ===
    citySlug.trim().toLowerCase()
  );
}

export async function fetchUkRegionListings(
  regionSlug: string,
): Promise<{
  region: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  listingCount: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs: Set<string>;
} | null> {
  const { regions, publishedCitySlugs } = await fetchUkDirectoryIndex();
  const regionRef = regions.find((r) => r.regionSlug === regionSlug.toLowerCase());
  if (!regionRef) return null;

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter(
    (row) =>
      parseDirectoryCountry(row.country) === COUNTRY_GB &&
      ukRegionMatchesState(regionRef.region, row.state),
  );
  const businesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);
  if (businesses.length < DIRECTORY_MIN_UK_REGION_LISTINGS) return null;

  const cityGroups = groupBusinessesByCity(businesses);
  return {
    region: regionRef.region,
    businesses,
    cityGroups,
    cityCount: cityGroups.length,
    listingCount: businesses.length,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
    publishedCitySlugs,
  };
}

export interface DirectorySummary {
  totalListings: number;
  cityHubCount: number;
  categoryPageCount: number;
  statePageCount: number;
  lastUpdatedLabel: string | null;
}

export async function fetchDirectoryLastUpdatedLabel(): Promise<string | null> {
  const { homepageLastModified } = await fetchDirectoryIndex();
  return formatLastUpdatedMonthYear(homepageLastModified?.toISOString());
}

export async function fetchDirectorySummary(): Promise<DirectorySummary> {
  const { cities, categories, states, homepageLastModified } =
    await fetchDirectoryIndex();
  return {
    totalListings: cities.reduce((sum, c) => sum + c.listingCount, 0),
    cityHubCount: cities.length,
    categoryPageCount: categories.filter(
      (c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS,
    ).length,
    statePageCount: states.length,
    lastUpdatedLabel: formatLastUpdatedMonthYear(
      homepageLastModified?.toISOString(),
    ),
  };
}

export async function fetchAllDirectoryCities(): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities;
}

export async function fetchAllDirectoryStates(): Promise<DirectoryStateRef[]> {
  const { states } = await fetchDirectoryIndex();
  return states;
}

export async function fetchTopStates(
  limit = 8,
): Promise<DirectoryStateRef[]> {
  const { states } = await fetchDirectoryIndex();
  return states.slice(0, limit);
}

export async function fetchCityListings(
  citySlug: string,
): Promise<DirectoryBusiness[] | null> {
  const parsed = parseCitySlug(citySlug);
  if (!parsed) return null;

  if (parsed.country === COUNTRY_GB) {
    const { cities } = await fetchUkDirectoryIndex();
    if (!cities.some((c) => c.citySlug === citySlug.toLowerCase())) {
      return null;
    }
  } else {
    const { cities } = await fetchDirectoryIndex();
    if (!cities.some((c) => c.citySlug === citySlug.toLowerCase())) {
      return null;
    }
  }

  const rows = await fetchAllNoWebsiteRows();
  return rows
    .filter((row) => rowMatchesCitySlug(row, citySlug))
    .map(rowToBusiness)
    .sort(sortByReviewsDesc);
}

export async function fetchCityHub(citySlug: string): Promise<{
  city: string;
  state: string;
  country: DirectoryCountry;
  listingCount: number;
  categories: DirectoryCategoryRef[];
  publishedCategories: DirectoryCategoryRef[];
  lastUpdatedLabel: string | null;
} | null> {
  const parsed = parseCitySlug(citySlug);
  if (!parsed) return null;

  const index = await fetchDirectoryIndex();
  const ukIndex = await fetchUkDirectoryIndex();
  const cityRef =
    parsed.country === COUNTRY_GB
      ? ukIndex.cities.find((c) => c.citySlug === citySlug.toLowerCase())
      : index.cities.find((c) => c.citySlug === citySlug.toLowerCase());
  if (!cityRef) return null;

  const allCityCategories = index.cityCategoriesAll.filter(
    (c) => c.citySlug === citySlug.toLowerCase(),
  );

  const categories: DirectoryCategoryRef[] = allCityCategories
    .map((m) => ({
      categorySlug: m.categorySlug,
      categoryLabel: m.categoryLabel,
      listingCount: m.listingCount,
    }))
    .sort((a, b) => b.listingCount - a.listingCount);

  const publishedCategorySlugs = new Set(
    index.categories
      .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
      .map((c) => c.categorySlug),
  );
  const publishedCategories = categories.filter((c) =>
    publishedCategorySlugs.has(c.categorySlug),
  );

  return {
    city: cityRef.city,
    state: cityRef.state,
    country: cityRef.country,
    listingCount: cityRef.listingCount,
    categories,
    publishedCategories,
    lastUpdatedLabel: formatLastUpdatedMonthYear(cityRef.lastModifiedAt),
  };
}

const fetchCategoryMatchedRows = cache(
  async (categorySlug: string): Promise<RawDirectoryRow[]> => {
    const slug = categorySlug.trim().toLowerCase();
    const rows = await fetchAllNoWebsiteRows();
    return rows.filter((row) =>
      categoryMatchesSlug(row.main_category, row.business_type, slug),
    );
  },
);

export async function fetchNationwideCategoryListings(
  categorySlug: string,
  opts?: { page?: number; pageSize?: number },
): Promise<{
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs: Set<string>;
} | null> {
  const slug = categorySlug.trim().toLowerCase();
  const pageSize = opts?.pageSize ?? DIRECTORY_CATEGORY_PAGE_SIZE;

  const index = await fetchDirectoryIndex();
  const categoryRef = index.categories.find((c) => c.categorySlug === slug);
  if (
    !categoryRef ||
    categoryRef.totalCount < DIRECTORY_MIN_CATEGORY_LISTINGS
  ) {
    return null;
  }

  const matched = await fetchCategoryMatchedRows(slug);
  const allBusinesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);
  const totalCount = allBusinesses.length;

  if (totalCount < DIRECTORY_MIN_CATEGORY_LISTINGS) return null;

  const totalPages = totalDirectoryPages(totalCount, pageSize);
  const page = clampDirectoryPage(opts?.page ?? 1, totalPages);
  const start = (page - 1) * pageSize;
  const businesses = allBusinesses.slice(start, start + pageSize);

  const categoryLabel =
    categoryRef.categoryLabel ??
    directoryCategoryLabel(
      matched[0]?.main_category,
      matched[0]?.business_type,
    ) ??
    slug;

  const cityGroups =
    totalPages > 1
      ? []
      : groupBusinessesByCity(businesses);

  const cityCount = new Set(
    allBusinesses.map((b) => {
      const city = b.city?.trim();
      const state = b.state?.trim();
      if (!city || !state) return null;
      return cityStateToSlug(city, state, b.country);
    }).filter(Boolean),
  ).size;

  return {
    categoryLabel,
    businesses,
    cityGroups,
    cityCount,
    totalCount,
    page,
    pageSize,
    totalPages,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
    publishedCitySlugs: index.publishedCitySlugs,
  };
}

/** All listings for a published category (e.g. CSV export). */
export async function fetchNationwideCategoryAllListings(
  categorySlug: string,
): Promise<{
  categoryLabel: string;
  businesses: DirectoryBusiness[];
} | null> {
  const slug = categorySlug.trim().toLowerCase();
  const index = await fetchDirectoryIndex();
  const categoryRef = index.categories.find((c) => c.categorySlug === slug);
  if (
    !categoryRef ||
    categoryRef.totalCount < DIRECTORY_MIN_CATEGORY_LISTINGS
  ) {
    return null;
  }

  const matched = await fetchCategoryMatchedRows(slug);
  const businesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);
  if (businesses.length < DIRECTORY_MIN_CATEGORY_LISTINGS) return null;

  return {
    categoryLabel: categoryRef.categoryLabel,
    businesses,
  };
}

async function fetchStateMatchedBusinesses(stateSlug: string): Promise<{
  state: string;
  allBusinesses: DirectoryBusiness[];
  matchedRows: RawDirectoryRow[];
  publishedCitySlugs: Set<string>;
} | null> {
  const parsed = parseStateSlug(stateSlug);
  if (!parsed) return null;

  const index = await fetchDirectoryIndex();
  const stateRef = index.states.find(
    (s) => s.stateSlug === stateSlug.toLowerCase(),
  );
  if (!stateRef) return null;

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter(
    (row) =>
      parseDirectoryCountry(row.country) === COUNTRY_US &&
      stateToAbbr(row.state ?? "") === parsed.stateAbbr,
  );
  const allBusinesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);

  if (allBusinesses.length < DIRECTORY_MIN_STATE_LISTINGS) return null;

  return {
    state: stateRef.state,
    allBusinesses,
    matchedRows: matched,
    publishedCitySlugs: index.publishedCitySlugs,
  };
}

export async function fetchStateListings(
  stateSlug: string,
  opts?: { page?: number; pageSize?: number },
): Promise<{
  state: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs: Set<string>;
} | null> {
  const base = await fetchStateMatchedBusinesses(stateSlug);
  if (!base) return null;

  const pageSize = opts?.pageSize ?? DIRECTORY_STATE_PAGE_SIZE;
  const totalCount = base.allBusinesses.length;
  const totalPages = totalDirectoryPages(totalCount, pageSize);
  const page = clampDirectoryPage(opts?.page ?? 1, totalPages);
  const start = (page - 1) * pageSize;
  const businesses = base.allBusinesses.slice(start, start + pageSize);

  const cityGroups =
    totalPages > 1 ? [] : groupBusinessesByCity(base.allBusinesses);

  const cityCount = new Set(
    base.allBusinesses.map((b) => {
      const city = b.city?.trim();
      const state = b.state?.trim();
      if (!city || !state) return null;
      return cityStateToSlug(city, state, b.country);
    }).filter(Boolean),
  ).size;

  return {
    state: base.state,
    businesses,
    cityGroups,
    cityCount,
    totalCount,
    page,
    pageSize,
    totalPages,
    lastUpdatedLabel: formatLastUpdatedMonthYear(
      maxFreshnessIso(base.matchedRows),
    ),
    publishedCitySlugs: base.publishedCitySlugs,
  };
}

export async function fetchStateAllListings(
  stateSlug: string,
): Promise<{
  state: string;
  businesses: DirectoryBusiness[];
} | null> {
  const base = await fetchStateMatchedBusinesses(stateSlug);
  if (!base) return null;

  return {
    state: base.state,
    businesses: base.allBusinesses,
  };
}

export async function fetchAllValidCitySlugs(): Promise<{ slug: string }[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities.map((c) => ({ slug: c.citySlug }));
}

export async function fetchAllValidCategorySlugs(): Promise<{ slug: string }[]> {
  const { categories } = await fetchDirectoryIndex();
  return categories
    .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
    .map((c) => ({ slug: c.categorySlug }));
}

export async function fetchAllValidStateSlugs(): Promise<{ slug: string }[]> {
  const { states } = await fetchDirectoryIndex();
  return states.map((s) => ({ slug: s.stateSlug }));
}

export async function fetchAllValidUkCitySlugs(): Promise<{ slug: string }[]> {
  const { cities } = await fetchUkDirectoryIndex();
  return cities.map((c) => ({ slug: c.citySlug }));
}

export async function fetchAllValidUkRegionSlugs(): Promise<{ slug: string }[]> {
  const { regions } = await fetchUkDirectoryIndex();
  return regions.map((r) => ({ slug: r.regionSlug }));
}

export async function fetchAllValidSlugParams(): Promise<{ slug: string }[]> {
  const [cities, ukCities, categories, states, ukRegions] = await Promise.all([
    fetchAllValidCitySlugs(),
    fetchAllValidUkCitySlugs(),
    fetchAllValidCategorySlugs(),
    fetchAllValidStateSlugs(),
    fetchAllValidUkRegionSlugs(),
  ]);
  return [...cities, ...ukCities, ...categories, ...states, ...ukRegions];
}

export interface PublishedCategoryLink {
  categoryLabel: string;
  categorySlug: string;
  href: string;
  count: number;
}

export async function fetchAllPublishedCategoryLinks(): Promise<
  PublishedCategoryLink[]
> {
  const { categories } = await fetchDirectoryIndex();

  return categories
    .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
    .map((c) => ({
      categoryLabel: c.categoryLabel,
      categorySlug: c.categorySlug,
      href: `/${c.categorySlug}`,
      count: c.totalCount,
    }));
}

/** @deprecated Use fetchAllPublishedCategoryLinks */
export async function fetchFeaturedCategoryLinks(): Promise<
  PublishedCategoryLink[]
> {
  return fetchAllPublishedCategoryLinks();
}
