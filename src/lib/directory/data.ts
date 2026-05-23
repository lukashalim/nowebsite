import { cache } from "react";
import {
  categoryLabelToSlug,
  cityStateToSlug,
  directoryCategoryLabel,
  parseCategorySlug,
  parseCitySlug,
  stateAbbrToDisplayName,
} from "@/lib/directory/slugs";
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
}> => {
  const rows = await fetchAllNoWebsiteRows();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const categoryCounts = new Map<string, { categoryLabel: string; categorySlug: string; totalCount: number }>();
  const cityCategoryCounts = new Map<string, DirectoryCityCategoryRef>();
  let homepageLastModifiedIso: string | null = null;

  for (const row of rows) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    if (!city || !state) continue;

    homepageLastModifiedIso = bumpFreshnessIso(homepageLastModifiedIso, row);

    const citySlug = cityStateToSlug(city, state);
    if (!citySlug) continue;

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

    const label = directoryCategoryLabel(row.main_category, row.business_type);
    if (!label) continue;

    const categorySlug = categoryLabelToSlug(label);

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
  /** Businesses in published city hubs (city + state; category not required). */
  totalListings: number;
  /** Cities with at least DIRECTORY_MIN_LISTINGS businesses. */
  cityHubCount: number;
  /** City + category pages (each has DIRECTORY_MIN_LISTINGS+ listings). */
  categoryPageCount: number;
}

export async function fetchDirectorySummary(): Promise<DirectorySummary> {
  const { cities, categories } = await fetchDirectoryIndex();
  return {
    totalListings: cities.reduce((sum, c) => sum + c.listingCount, 0),
    cityHubCount: cities.length,
    categoryPageCount: categories.filter(
      (c) => c.totalCount >= DIRECTORY_MIN_LISTINGS,
    ).length,
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
        cityStateToSlug(row.city ?? "", row.state ?? "") === citySlug.toLowerCase(),
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

  const publishedCategorySlugs = new Set(
    index.categories
      .filter((c) => c.totalCount >= DIRECTORY_MIN_LISTINGS)
      .map((c) => c.categorySlug),
  );
  const publishedCategories = categories.filter((c) =>
    publishedCategorySlugs.has(c.categorySlug),
  );

  return {
    city: cityRef.city,
    state: cityRef.state,
    listingCount: cityRef.listingCount,
    categories,
    publishedCategories,
  };
}

export async function fetchNationwideCategoryListings(
  categorySlug: string,
): Promise<{
  categoryLabel: string;
  businesses: DirectoryBusiness[];
  lastUpdatedLabel: string | null;
} | null> {
  const categoryParsed = parseCategorySlug(categorySlug);
  if (!categoryParsed) return null;

  const index = await fetchDirectoryIndex();
  const categoryRef = index.categories.find(
    (c) => c.categorySlug === categorySlug.trim().toLowerCase(),
  );
  if (!categoryRef || categoryRef.totalCount < DIRECTORY_MIN_LISTINGS) {
    return null;
  }

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter((row) => categoryMatchesRow(row, categorySlug));
  const businesses = matched.sort(sortByReviewsDesc);

  if (businesses.length < DIRECTORY_MIN_LISTINGS) return null;

  const label =
    directoryCategoryLabel(
      businesses[0]?.main_category,
      businesses[0]?.business_type,
    ) ?? categoryRef.categoryLabel;

  return {
    categoryLabel: label,
    businesses,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
  };
}

function categoryMatchesRow(row: RawDirectoryRow, categorySlug: string): boolean {
  const label = directoryCategoryLabel(row.main_category, row.business_type);
  if (!label) return false;
  return categoryLabelToSlug(label) === categorySlug.trim().toLowerCase();
}

export async function fetchAllValidCitySlugs(): Promise<{ slug: string }[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities.map((c) => ({ slug: c.citySlug }));
}

export async function fetchAllValidCategorySlugs(): Promise<{ slug: string }[]> {
  const { categories } = await fetchDirectoryIndex();
  return categories
    .filter((c) => c.totalCount >= DIRECTORY_MIN_LISTINGS)
    .map((c) => ({ slug: c.categorySlug }));
}

export async function fetchAllValidSlugParams(): Promise<{ slug: string }[]> {
  const [cities, categories] = await Promise.all([
    fetchAllValidCitySlugs(),
    fetchAllValidCategorySlugs(),
  ]);
  return [...cities, ...categories];
}

export async function fetchAllValidCityCategorySlugs(): Promise<
  { slug: string; categorySlug: string }[]
> {
  const { cityCategories } = await fetchDirectoryIndex();
  return cityCategories.map((c) => ({
    slug: c.citySlug,
    categorySlug: c.categorySlug,
  }));
}

export interface PublishedCategoryLink {
  categoryLabel: string;
  categorySlug: string;
  href: string;
  count: number;
}

/** Nationwide category pages with DIRECTORY_MIN_LISTINGS+ listings. */
export async function fetchAllPublishedCategoryLinks(): Promise<
  PublishedCategoryLink[]
> {
  const { categories } = await fetchDirectoryIndex();

  return categories
    .filter((c) => c.totalCount >= DIRECTORY_MIN_LISTINGS)
    .map((c) => ({
      categoryLabel: c.categoryLabel,
      categorySlug: c.categorySlug,
      href: `/${c.categorySlug}`,
      count: c.totalCount,
    }));
}

/** @deprecated Use fetchAllPublishedCategoryLinks */
export async function fetchFeaturedCategoryLinks(): Promise<PublishedCategoryLink[]> {
  return fetchAllPublishedCategoryLinks();
}
