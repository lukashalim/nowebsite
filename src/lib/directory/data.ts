import { cache } from "react";
import { formatLastUpdatedMonthYear } from "@/lib/directory/labels";
import {
  COUNTRY_GB,
  COUNTRY_US,
} from "@/lib/directory/country";
import {
  cityStateToSlug,
  directoryCategoryLabel,
  parseCitySlug,
  parseStateSlug,
  resolveCategoryForRow,
  isUsStateForDirectory,
  stateNameToSlug,
  stateToAbbr,
} from "@/lib/directory/slugs";
import type {
  DirectoryBusiness,
  DirectoryCategoryRef,
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
  bumpFreshnessIsoFromCandidate,
  fetchDirectoryFreshnessMax,
  fetchDirectoryUsListingTotal,
  fetchFacebookDirectoryListingTotal,
  fetchUsCategoryIndex,
  fetchUsCityCategoryIndex,
  fetchUsCityIndex,
  fetchUsStateIndex,
} from "@/lib/directory/aggregate-queries";
import { fetchCategoryContent } from "@/lib/directory/category-content";
import type { CategoryContent } from "@/lib/directory/category-content";
import { sortCategoriesByPriority } from "@/lib/directory/category-priority";
import {
  applyDirectoryListingFilters,
  buildDirectoryFilterOptions,
  DEFAULT_DIRECTORY_LISTING_FILTERS,
  sanitizeDirectoryListingFilters,
  type DirectoryFilterOptions,
  type DirectoryListingFilters,
} from "@/lib/directory/listing-filters";
import {
  clampDirectoryPage,
  DIRECTORY_CATEGORY_PAGE_SIZE,
  DIRECTORY_FACEBOOK_PAGE_SIZE,
  DIRECTORY_STATE_PAGE_SIZE,
  totalDirectoryPages,
} from "@/lib/directory/pagination";
import {
  bumpFreshnessIso,
  fetchAllNoWebsiteRows,
  groupBusinessesByCity,
  maxFreshnessIso,
  rowToBusiness,
  sortByReviewsDesc,
  type RawDirectoryRow,
} from "@/lib/directory/rows";
import {
  fetchDirectoryRowsForCategorySlug,
  fetchDirectoryRowsForCity,
  fetchDirectoryRowsForStateAbbr,
} from "@/lib/directory/scoped-rows";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

export {
  fetchAllNoWebsiteRows,
  groupBusinessesByCity,
  rowToBusiness,
} from "@/lib/directory/rows";
export { fetchGbDirectoryIndex, fetchUkDirectoryIndex } from "@/lib/directory/gb-data";

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

export interface DirectoryListingsPageSlice {
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  totalCount: number;
  unfilteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: DirectoryListingFilters;
  filterOptions: DirectoryFilterOptions;
}

function countDistinctCitySlugs(businesses: DirectoryBusiness[]): number {
  return new Set(
    businesses
      .map((b) => {
        const city = b.city?.trim();
        const state = b.state?.trim();
        if (!city || !state) return null;
        return cityStateToSlug(city, state, b.country);
      })
      .filter(Boolean),
  ).size;
}

function paginateDirectoryCohort(
  allBusinesses: DirectoryBusiness[],
  opts: {
    page?: number;
    pageSize: number;
    filters?: DirectoryListingFilters;
    filterMode?: "full" | "stateFixed" | "reviewsOnly";
    fixedStateSlug?: string | null;
  },
): DirectoryListingsPageSlice {
  const unfilteredCount = allBusinesses.length;
  const filterOptions = buildDirectoryFilterOptions(allBusinesses);
  const filters = sanitizeDirectoryListingFilters(
    opts.filters ?? DEFAULT_DIRECTORY_LISTING_FILTERS,
    filterOptions,
    { mode: opts.filterMode, fixedStateSlug: opts.fixedStateSlug },
  );
  const filtered = applyDirectoryListingFilters(allBusinesses, filters);
  const totalCount = filtered.length;
  const pageSize = opts.pageSize;
  const totalPages = totalDirectoryPages(totalCount, pageSize);
  const page = clampDirectoryPage(opts.page ?? 1, totalPages);
  const start = (page - 1) * pageSize;
  const businesses = filtered.slice(start, start + pageSize);
  const cityGroups =
    totalPages > 1 ? [] : groupBusinessesByCity(filtered);

  return {
    businesses,
    cityGroups,
    cityCount: countDistinctCitySlugs(filtered),
    totalCount,
    unfilteredCount,
    page,
    pageSize,
    totalPages,
    filters,
    filterOptions,
  };
}

export interface FacebookDirectoryPageData extends DirectoryListingsPageSlice {
  lastUpdatedLabel: string | null;
}

export const fetchFacebookDirectoryPageData = cache(
  async (opts?: {
    page?: number;
    pageSize?: number;
    filters?: DirectoryListingFilters;
  }): Promise<FacebookDirectoryPageData> => {
    const rows = await fetchAllFacebookSurfaceRows();
    const allBusinesses = rows.map(rowToBusiness).sort(sortByReviewsDesc);
    const slice = paginateDirectoryCohort(allBusinesses, {
      page: opts?.page,
      pageSize: opts?.pageSize ?? DIRECTORY_FACEBOOK_PAGE_SIZE,
      filters: opts?.filters,
      filterMode: "full",
    });

    return {
      ...slice,
      lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(rows)),
    };
  },
);

/** All Facebook-surface listings (e.g. CSV export). */
export const fetchFacebookDirectoryAllListings = cache(async (): Promise<{
  businesses: DirectoryBusiness[];
} | null> => {
  const rows = await fetchAllFacebookSurfaceRows();
  const businesses = rows.map(rowToBusiness).sort(sortByReviewsDesc);
  if (businesses.length === 0) return null;
  return { businesses };
});

export const fetchDirectoryIndex = cache(async (): Promise<{
  cities: DirectoryCityRef[];
  categories: {
    categoryLabel: string;
    categorySlug: string;
    totalCount: number;
    lastModifiedAt: string | null;
  }[];
  states: DirectoryStateRef[];
  publishedCitySlugs: Set<string>;
  homepageLastModified: Date | null;
  /** Every US listing with city + state (not only 50+ city hubs). */
  totalUsListings: number;
}> => {
  const [cityRows, categoryRows, stateRows, totalUsListings, freshnessMax] =
    await Promise.all([
      fetchUsCityIndex(DIRECTORY_MIN_CITY_LISTINGS),
      fetchUsCategoryIndex(),
      fetchUsStateIndex(),
      fetchDirectoryUsListingTotal(),
      fetchDirectoryFreshnessMax(),
    ]);

  const cities = cityRows
    .map((row) => {
      const citySlug = cityStateToSlug(row.city, row.state, COUNTRY_US);
      if (!citySlug) return null;
      return {
        citySlug,
        city: row.city,
        state: row.state,
        region: row.state,
        regionSlug: stateNameToSlug(row.state),
        country: COUNTRY_US,
        listingCount: row.listing_count,
        lastModifiedAt: row.last_modified_at,
      };
    })
    .filter((c) => c !== null)
    .sort((a, b) => b.listingCount - a.listingCount);

  const publishedCitySlugs = new Set(cities.map((c) => c.citySlug));

  const categoryCounts = new Map<
    string,
    {
      categoryLabel: string;
      categorySlug: string;
      totalCount: number;
      lastModifiedAt: string | null;
    }
  >();

  for (const row of categoryRows) {
    const resolved = resolveCategoryForRow(row.main_category, row.business_type);
    if (!resolved) continue;

    const label = directoryCategoryLabel(row.main_category, row.business_type);
    const existingCat = categoryCounts.get(resolved.slug);
    if (existingCat) {
      existingCat.totalCount += row.listing_count;
      existingCat.lastModifiedAt = bumpFreshnessIsoFromCandidate(
        existingCat.lastModifiedAt,
        row.last_modified_at,
      );
    } else {
      categoryCounts.set(resolved.slug, {
        categoryLabel: label ?? resolved.label,
        categorySlug: resolved.slug,
        totalCount: row.listing_count,
        lastModifiedAt: row.last_modified_at,
      });
    }
  }

  const categories = sortCategoriesByPriority(
    [...categoryCounts.values()].filter((c) => c.totalCount > 0),
  );

  const states = stateRows
    .map((row) => {
      const stateSlug = stateNameToSlug(row.state);
      const stateAbbr = stateToAbbr(row.state);
      if (!stateSlug || !stateAbbr || !isUsStateForDirectory(row.state)) {
        return null;
      }
      return {
        stateSlug,
        state: row.state,
        country: COUNTRY_US,
        listingCount: row.listing_count,
        lastModifiedAt: row.last_modified_at,
      };
    })
    .filter((s): s is DirectoryStateRef => s !== null)
    .filter((s) => s.listingCount >= DIRECTORY_MIN_STATE_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  const homepageLastModified = freshnessMax ? new Date(freshnessMax) : null;

  return {
    cities,
    categories,
    states,
    publishedCitySlugs,
    homepageLastModified,
    totalUsListings,
  };
});

export {
  fetchGbListingCount,
  fetchUkCities,
  fetchUkListingCount,
} from "@/lib/directory/gb-data";

export { fetchFacebookDirectoryListingTotal } from "@/lib/directory/aggregate-queries";

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
  const { cities, categories, states, homepageLastModified, totalUsListings } =
    await fetchDirectoryIndex();
  return {
    totalListings: totalUsListings,
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
  opts?: { filters?: DirectoryListingFilters },
): Promise<DirectoryListingsPageSlice | null> {
  const parsed = parseCitySlug(citySlug);
  if (!parsed) return null;

  if (parsed.country === COUNTRY_GB) {
    return null;
  }

  const { cities } = await fetchDirectoryIndex();
  const cityRef = cities.find((c) => c.citySlug === citySlug.toLowerCase());
  if (!cityRef) return null;

  const rows = await fetchDirectoryRowsForCity(cityRef.city, cityRef.state);
  const allBusinesses = rows.map(rowToBusiness).sort(sortByReviewsDesc);

  const slice = paginateDirectoryCohort(allBusinesses, {
    page: 1,
    pageSize: allBusinesses.length || 1,
    filters: opts?.filters,
    filterMode: "reviewsOnly",
  });

  return slice;
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

  if (parsed.country === COUNTRY_GB) return null;

  const index = await fetchDirectoryIndex();
  const cityRef = index.cities.find((c) => c.citySlug === citySlug.toLowerCase());
  if (!cityRef) return null;

  const cityCategoryRows = await fetchUsCityCategoryIndex(
    cityRef.city,
    cityRef.state,
  );

  const categories: DirectoryCategoryRef[] = sortCategoriesByPriority(
    cityCategoryRows
      .map((row) => {
        const resolved = resolveCategoryForRow(
          row.main_category,
          row.business_type,
        );
        if (!resolved) return null;
        const label = directoryCategoryLabel(
          row.main_category,
          row.business_type,
        );
        return {
          categorySlug: resolved.slug,
          categoryLabel: label ?? resolved.label,
          listingCount: row.listing_count,
        };
      })
      .filter((c): c is DirectoryCategoryRef => c !== null),
  );

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

export async function fetchNationwideCategoryListings(
  categorySlug: string,
  opts?: {
    page?: number;
    pageSize?: number;
    filters?: DirectoryListingFilters;
  },
): Promise<{
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  totalCount: number;
  unfilteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs: Set<string>;
  content: CategoryContent | null;
  filters: DirectoryListingFilters;
  filterOptions: DirectoryFilterOptions;
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

  const [matched, content] = await Promise.all([
    fetchDirectoryRowsForCategorySlug(slug),
    fetchCategoryContent(slug),
  ]);
  const allBusinesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);

  if (allBusinesses.length < DIRECTORY_MIN_CATEGORY_LISTINGS) return null;

  const slice = paginateDirectoryCohort(allBusinesses, {
    page: opts?.page,
    pageSize,
    filters: opts?.filters,
    filterMode: "full",
  });

  const categoryLabel =
    content?.displayName?.trim() ||
    categoryRef.categoryLabel ||
    directoryCategoryLabel(
      matched[0]?.main_category,
      matched[0]?.business_type,
    ) ||
    slug;

  return {
    categoryLabel,
    businesses: slice.businesses,
    cityGroups: slice.cityGroups,
    cityCount: slice.cityCount,
    totalCount: slice.totalCount,
    unfilteredCount: slice.unfilteredCount,
    page: slice.page,
    pageSize: slice.pageSize,
    totalPages: slice.totalPages,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
    publishedCitySlugs: index.publishedCitySlugs,
    content,
    filters: slice.filters,
    filterOptions: slice.filterOptions,
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

  const matched = await fetchDirectoryRowsForCategorySlug(slug);
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

  const matched = await fetchDirectoryRowsForStateAbbr(parsed.stateAbbr);
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
  opts?: {
    page?: number;
    pageSize?: number;
    filters?: DirectoryListingFilters;
  },
): Promise<{
  state: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  totalCount: number;
  unfilteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs: Set<string>;
  filters: DirectoryListingFilters;
  filterOptions: DirectoryFilterOptions;
} | null> {
  const base = await fetchStateMatchedBusinesses(stateSlug);
  if (!base) return null;

  const slice = paginateDirectoryCohort(base.allBusinesses, {
    page: opts?.page,
    pageSize: opts?.pageSize ?? DIRECTORY_STATE_PAGE_SIZE,
    filters: opts?.filters,
    filterMode: "stateFixed",
    fixedStateSlug: stateSlug.toLowerCase(),
  });

  return {
    state: base.state,
    businesses: slice.businesses,
    cityGroups: slice.cityGroups,
    cityCount: slice.cityCount,
    totalCount: slice.totalCount,
    unfilteredCount: slice.unfilteredCount,
    page: slice.page,
    pageSize: slice.pageSize,
    totalPages: slice.totalPages,
    lastUpdatedLabel: formatLastUpdatedMonthYear(
      maxFreshnessIso(base.matchedRows),
    ),
    publishedCitySlugs: base.publishedCitySlugs,
    filters: slice.filters,
    filterOptions: slice.filterOptions,
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

export async function fetchAllValidSlugParams(): Promise<{ slug: string }[]> {
  const [cities, categories, states] = await Promise.all([
    fetchAllValidCitySlugs(),
    fetchAllValidCategorySlugs(),
    fetchAllValidStateSlugs(),
  ]);
  return [...cities, ...categories, ...states];
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

  return sortCategoriesByPriority(
    categories
      .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
      .map((c) => ({
        categoryLabel: c.categoryLabel,
        categorySlug: c.categorySlug,
        href: `/${c.categorySlug}`,
        count: c.totalCount,
      })),
  );
}

/** @deprecated Use fetchAllPublishedCategoryLinks */
export async function fetchFeaturedCategoryLinks(): Promise<
  PublishedCategoryLink[]
> {
  return fetchAllPublishedCategoryLinks();
}
