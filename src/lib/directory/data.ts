import { cache } from "react";
import {
  categoryLabelToSlug,
  cityStateToSlug,
  directoryCategoryLabel,
  isPlaceholderBusinessType,
  parseCategorySlug,
  parseCitySlug,
  stateAbbrToDisplayName,
} from "@/lib/directory/slugs";
import { businessTypeFromCategorySlug } from "@/lib/directory/search-category-map";
import { formatLastUpdatedMonthYear } from "@/lib/directory/labels";
import type {
  DirectoryBusiness,
  DirectoryCategoryRef,
  DirectoryCityCategoryRef,
  DirectoryCityRef,
} from "@/lib/directory/types";
import { DIRECTORY_MIN_LISTINGS, DIRECTORY_LIST_COLUMNS } from "@/lib/directory/types";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

interface RawDirectoryRow {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
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

async function fetchMaxLastScrapedAtForCityCategory(
  city: string,
  state: string,
  businessType: string,
): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("businesses_nowebsite")
    .select("last_scraped_at, scraped_at")
    .eq("has_website", false)
    .eq("city", city)
    .eq("state", state)
    .eq("business_type", businessType);

  if (error) {
    return null;
  }
  return maxFreshnessIso((data ?? []) as RawDirectoryRow[]);
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

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as RawDirectoryRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return rows;
});

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

export const fetchDirectoryIndex = cache(async (): Promise<{
  cities: DirectoryCityRef[];
  categories: { categoryLabel: string; categorySlug: string; totalCount: number }[];
  cityCategories: DirectoryCityCategoryRef[];
  cityCategoriesAll: DirectoryCityCategoryRef[];
  homepageLastModified: Date | null;
}> {
  const rows = await fetchAllNoWebsiteRows();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const categoryCounts = new Map<string, { categoryLabel: string; categorySlug: string; totalCount: number }>();
  const cityCategoryCounts = new Map<string, DirectoryCityCategoryRef>();
  let homepageLastModifiedIso: string | null = null;

  for (const row of rows) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    const label = directoryCategoryLabel(row.main_category, row.business_type);
    if (!city || !state || !label) continue;

    homepageLastModifiedIso = bumpFreshnessIso(homepageLastModifiedIso, row);

    const citySlug = cityStateToSlug(city, state);
    if (!citySlug) continue;
    const categorySlug = categoryLabelToSlug(label);

    const cityKey = citySlug;
    const existingCity = cityCounts.get(cityKey);
    if (existingCity) {
      existingCity.listingCount += 1;
      existingCity.lastModifiedAt = bumpFreshnessIso(existingCity.lastModifiedAt, row);
    } else {
      cityCounts.set(cityKey, {
        citySlug,
        city,
        state,
        listingCount: 1,
        lastModifiedAt: bumpFreshnessIso(null, row),
      });
    }

    const catKey = categorySlug;
    const existingCat = categoryCounts.get(catKey);
    if (existingCat) {
      existingCat.totalCount += 1;
    } else {
      categoryCounts.set(catKey, {
        categoryLabel: label,
        categorySlug,
        totalCount: 1,
      });
    }

    const ccKey = `${citySlug}::${categorySlug}`;
    const existingCc = cityCategoryCounts.get(ccKey);
    if (existingCc) {
      existingCc.listingCount += 1;
      existingCc.lastModifiedAt = bumpFreshnessIso(existingCc.lastModifiedAt, row);
    } else {
      cityCategoryCounts.set(ccKey, {
        citySlug,
        categorySlug,
        city,
        state,
        categoryLabel: label,
        listingCount: 1,
        lastModifiedAt: bumpFreshnessIso(null, row),
      });
    }
  }

  const cities = [...cityCounts.values()]
    .filter((c) => c.listingCount >= DIRECTORY_MIN_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  const categories = [...categoryCounts.values()].sort(
    (a, b) => b.totalCount - a.totalCount,
  );

  const cityCategoriesPublished = [...cityCategoryCounts.values()].filter(
    (c) => c.listingCount >= DIRECTORY_MIN_LISTINGS,
  );

  const homepageLastModified = homepageLastModifiedIso
    ? new Date(homepageLastModifiedIso)
    : null;

  return {
    cities,
    categories,
    cityCategories: cityCategoriesPublished,
    cityCategoriesAll: [...cityCategoryCounts.values()],
    homepageLastModified,
  };
});

export interface DirectorySummary {
  /** Businesses with city, state, and a directory category label. */
  totalListings: number;
  /** Cities with at least DIRECTORY_MIN_LISTINGS businesses. */
  cityHubCount: number;
  /** City + category pages (each has DIRECTORY_MIN_LISTINGS+ listings). */
  categoryPageCount: number;
}

export async function fetchDirectorySummary(): Promise<DirectorySummary> {
  const { cities, cityCategories } = await fetchDirectoryIndex();
  return {
    totalListings: cities.reduce((sum, c) => sum + c.listingCount, 0),
    cityHubCount: cities.length,
    categoryPageCount: cityCategories.length,
  };
}

export async function fetchAllDirectoryCities(): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities;
}

export async function fetchTopCities(limit = 5): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities.slice(0, limit);
}

export async function fetchCityListings(
  citySlug: string,
): Promise<DirectoryBusiness[] | null> {
  const parsed = parseCitySlug(citySlug);
  if (!parsed) return null;

  const { cities } = await fetchDirectoryIndex();
  if (!cities.some((c) => c.citySlug === citySlug.toLowerCase())) {
    return null;
  }

  const rows = await fetchAllNoWebsiteRows();
  return rows
    .filter(
      (row) =>
        cityStateToSlug(row.city ?? "", row.state ?? "") ===
          citySlug.toLowerCase() && directoryCategoryLabel(row.main_category, row.business_type),
    )
    .sort(sortByReviewsDesc);
}

export async function fetchCityHub(citySlug: string): Promise<{
  city: string;
  state: string;
  listingCount: number;
  /** Every category in this city (any listing count). */
  categories: DirectoryCategoryRef[];
  /** Categories with a public directory page (DIRECTORY_MIN_LISTINGS+). */
  publishedCategories: DirectoryCategoryRef[];
} | null> {
  const parsed = parseCitySlug(citySlug);
  if (!parsed) return null;

  const index = await fetchDirectoryIndex();
  const cityRef = index.cities.find((c) => c.citySlug === citySlug.toLowerCase());
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

  const publishedCategories = categories.filter(
    (c) => c.listingCount >= DIRECTORY_MIN_LISTINGS,
  );

  return {
    city: cityRef.city,
    state: cityRef.state,
    listingCount: cityRef.listingCount,
    categories,
    publishedCategories,
  };
}

export async function fetchCategoryListings(
  citySlug: string,
  categorySlug: string,
): Promise<{
  city: string;
  state: string;
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  lastUpdatedLabel: string | null;
} | null> {
  const cityParsed = parseCitySlug(citySlug);
  const categoryParsed = parseCategorySlug(categorySlug);
  if (!cityParsed || !categoryParsed) return null;

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter(
    (row) =>
      cityStateToSlug(row.city ?? "", row.state ?? "") ===
        citySlug.toLowerCase() && categoryMatchesRow(row, categorySlug),
  );
  const businesses = matched.sort(sortByReviewsDesc);

  if (businesses.length < DIRECTORY_MIN_LISTINGS) return null;

  const city = businesses[0].city ?? cityParsed.cityPattern;
  const state =
    businesses[0].state ?? stateAbbrToDisplayName(cityParsed.stateAbbr);
  const label =
    directoryCategoryLabel(
      businesses[0]?.main_category,
      businesses[0]?.business_type,
    ) ?? categoryParsed.searchTerm;

  const queryBusinessType =
    businessTypeFromCategorySlug(categorySlug) ??
    (!isPlaceholderBusinessType(businesses[0]?.business_type)
      ? businesses[0].business_type?.trim() ?? null
      : null);

  let lastScrapedIso: string | null = null;
  if (queryBusinessType && city && state) {
    lastScrapedIso = await fetchMaxLastScrapedAtForCityCategory(
      city,
      state,
      queryBusinessType,
    );
  }
  if (!lastScrapedIso) {
    lastScrapedIso = maxFreshnessIso(matched);
  }

  return {
    city,
    state,
    categoryLabel: label,
    businesses,
    lastUpdatedLabel: formatLastUpdatedMonthYear(lastScrapedIso),
  };
}

function categoryMatchesRow(row: RawDirectoryRow, categorySlug: string): boolean {
  const label = directoryCategoryLabel(row.main_category, row.business_type);
  if (!label) return false;
  return categoryLabelToSlug(label) === categorySlug.trim().toLowerCase();
}

export async function fetchAllValidCitySlugs(): Promise<{ citySlug: string }[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities.map((c) => ({ citySlug: c.citySlug }));
}

export async function fetchAllValidCityCategorySlugs(): Promise<
  { citySlug: string; categorySlug: string }[]
> {
  const { cityCategories } = await fetchDirectoryIndex();
  return cityCategories.map((c) => ({
    citySlug: c.citySlug,
    categorySlug: c.categorySlug,
  }));
}

/** Best city hub URL per category for homepage grid links. */
export async function fetchFeaturedCategoryLinks(): Promise<
  { categoryLabel: string; categorySlug: string; href: string; count: number }[]
> {
  const { categories, cityCategories } = await fetchDirectoryIndex();
  const topCityByCategory = new Map<string, DirectoryCityCategoryRef>();

  for (const cc of cityCategories) {
    const prev = topCityByCategory.get(cc.categorySlug);
    if (!prev || cc.listingCount > prev.listingCount) {
      topCityByCategory.set(cc.categorySlug, cc);
    }
  }

  return categories
    .filter((c) => topCityByCategory.has(c.categorySlug))
    .slice(0, 12)
    .map((c) => {
      const top = topCityByCategory.get(c.categorySlug)!;
      return {
        categoryLabel: c.categoryLabel,
        categorySlug: c.categorySlug,
        href: `/${top.citySlug}/${top.categorySlug}`,
        count: c.totalCount,
      };
    });
}
