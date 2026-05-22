import {
  categoryLabelToSlug,
  cityStateToSlug,
  directoryCategoryLabel,
  parseCategorySlug,
  parseCitySlug,
  stateAbbrToDisplayName,
} from "@/lib/directory/slugs";
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
}

async function fetchAllNoWebsiteRows(): Promise<RawDirectoryRow[]> {
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
      .range(from, from + BATCH - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as RawDirectoryRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return rows;
}

function sortByReviewsDesc(a: DirectoryBusiness, b: DirectoryBusiness): number {
  return (b.reviews ?? 0) - (a.reviews ?? 0);
}

export async function fetchDirectoryIndex(): Promise<{
  cities: DirectoryCityRef[];
  categories: { categoryLabel: string; categorySlug: string; totalCount: number }[];
  cityCategories: DirectoryCityCategoryRef[];
}> {
  const rows = await fetchAllNoWebsiteRows();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const categoryCounts = new Map<string, { categoryLabel: string; categorySlug: string; totalCount: number }>();
  const cityCategoryCounts = new Map<string, DirectoryCityCategoryRef>();

  for (const row of rows) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    const label = directoryCategoryLabel(row.main_category, row.business_type);
    if (!city || !state || !label) continue;

    const citySlug = cityStateToSlug(city, state);
    if (!citySlug) continue;
    const categorySlug = categoryLabelToSlug(label);

    const cityKey = citySlug;
    const existingCity = cityCounts.get(cityKey);
    if (existingCity) {
      existingCity.listingCount += 1;
    } else {
      cityCounts.set(cityKey, {
        citySlug,
        city,
        state,
        listingCount: 1,
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
    } else {
      cityCategoryCounts.set(ccKey, {
        citySlug,
        categorySlug,
        city,
        state,
        categoryLabel: label,
        listingCount: 1,
      });
    }
  }

  const cities = [...cityCounts.values()]
    .filter((c) => c.listingCount >= DIRECTORY_MIN_LISTINGS)
    .sort((a, b) => b.listingCount - a.listingCount);

  const categories = [...categoryCounts.values()].sort(
    (a, b) => b.totalCount - a.totalCount,
  );

  const cityCategories = [...cityCategoryCounts.values()].filter(
    (c) => c.listingCount >= DIRECTORY_MIN_LISTINGS,
  );

  return { cities, categories, cityCategories };
}

export async function fetchTopCities(limit = 5): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities.slice(0, limit);
}

export async function fetchCityHub(citySlug: string): Promise<{
  city: string;
  state: string;
  categories: DirectoryCategoryRef[];
} | null> {
  const parsed = parseCitySlug(citySlug);
  if (!parsed) return null;

  const { cityCategories } = await fetchDirectoryIndex();
  const matches = cityCategories.filter((c) => c.citySlug === citySlug.toLowerCase());
  if (matches.length === 0) return null;

  const { city, state } = matches[0];
  const categories: DirectoryCategoryRef[] = matches
    .map((m) => ({
      categorySlug: m.categorySlug,
      categoryLabel: m.categoryLabel,
      listingCount: m.listingCount,
    }))
    .sort((a, b) => b.listingCount - a.listingCount);

  return { city, state, categories };
}

export async function fetchCategoryListings(
  citySlug: string,
  categorySlug: string,
): Promise<{
  city: string;
  state: string;
  categoryLabel: string;
  businesses: DirectoryBusiness[];
} | null> {
  const cityParsed = parseCitySlug(citySlug);
  const categoryParsed = parseCategorySlug(categorySlug);
  if (!cityParsed || !categoryParsed) return null;

  const rows = await fetchAllNoWebsiteRows();
  const businesses = rows
    .filter(
      (row) =>
        cityStateToSlug(row.city ?? "", row.state ?? "") ===
          citySlug.toLowerCase() &&
        categoryMatchesRow(row, categorySlug),
    )
    .sort(sortByReviewsDesc);

  if (businesses.length < DIRECTORY_MIN_LISTINGS) return null;

  const label =
    directoryCategoryLabel(
      businesses[0]?.main_category,
      businesses[0]?.business_type,
    ) ?? categoryParsed.searchTerm;

  return {
    city: businesses[0].city ?? cityParsed.cityPattern,
    state: businesses[0].state ?? stateAbbrToDisplayName(cityParsed.stateAbbr),
    categoryLabel: label,
    businesses,
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
        count: top.listingCount,
      };
    });
}
