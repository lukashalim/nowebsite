import { cache } from "react";
import {
  CANONICAL_CATEGORIES,
  canonicalCategoryFromSlug,
} from "@/lib/directory/categories";
import { formatLastUpdatedMonthYear } from "@/lib/directory/labels";
import {
  cityStateToSlug,
  directoryCategoryLabel,
  parseCitySlug,
  parseStateSlug,
  resolveCanonicalCategoryForRow,
  stateNameToSlug,
  stateToAbbr,
} from "@/lib/directory/slugs";
import type {
  DirectoryBusiness,
  DirectoryCategoryRef,
  DirectoryCityCategoryRef,
  DirectoryCityGroup,
  DirectoryCityRef,
  DirectoryStateRef,
} from "@/lib/directory/types";
import {
  DIRECTORY_LIST_COLUMNS,
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_CITY_LISTINGS,
  DIRECTORY_MIN_STATE_LISTINGS,
} from "@/lib/directory/types";
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

function rowToBusiness(row: RawDirectoryRow): DirectoryBusiness {
  return {
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
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

export function groupBusinessesByCity(
  businesses: DirectoryBusiness[],
): DirectoryCityGroup[] {
  const groups = new Map<string, DirectoryCityGroup>();

  for (const b of businesses) {
    const city = b.city?.trim();
    const state = b.state?.trim();
    if (!city || !state) continue;
    const citySlug = cityStateToSlug(city, state);
    if (!citySlug) continue;

    const key = citySlug;
    const existing = groups.get(key);
    if (existing) {
      existing.businesses.push(b);
    } else {
      groups.set(key, { city, state, citySlug, businesses: [b] });
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
  categories: { categoryLabel: string; categorySlug: string; totalCount: number }[];
  states: DirectoryStateRef[];
  cityCategoriesAll: DirectoryCityCategoryRef[];
  publishedCitySlugs: Set<string>;
  homepageLastModified: Date | null;
}> => {
  const rows = await fetchAllNoWebsiteRows();
  const cityCounts = new Map<string, DirectoryCityRef>();
  const categoryCounts = new Map<
    string,
    { categoryLabel: string; categorySlug: string; totalCount: number }
  >();
  const stateCounts = new Map<string, DirectoryStateRef>();
  const cityCategoryCounts = new Map<string, DirectoryCityCategoryRef>();
  let homepageLastModifiedIso: string | null = null;

  for (const canonical of CANONICAL_CATEGORIES) {
    categoryCounts.set(canonical.slug, {
      categoryLabel: canonical.label,
      categorySlug: canonical.slug,
      totalCount: 0,
    });
  }

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
      existingCity.lastModifiedAt = bumpFreshnessIso(
        existingCity.lastModifiedAt,
        row,
      );
    } else {
      cityCounts.set(cityKey, {
        citySlug,
        city,
        state,
        listingCount: 1,
        lastModifiedAt: bumpFreshnessIso(null, row),
      });
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
          listingCount: 1,
          lastModifiedAt: bumpFreshnessIso(null, row),
        });
      }
    }

    const canonical = resolveCanonicalCategoryForRow(
      row.main_category,
      row.business_type,
    );
    if (canonical) {
      const cat = categoryCounts.get(canonical.slug);
      if (cat) cat.totalCount += 1;

      const label = directoryCategoryLabel(row.main_category, row.business_type);
      const ccKey = `${citySlug}::${canonical.slug}`;
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
          categorySlug: canonical.slug,
          city,
          state,
          categoryLabel: label ?? canonical.label,
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

export interface DirectorySummary {
  totalListings: number;
  cityHubCount: number;
  categoryPageCount: number;
  statePageCount: number;
}

export async function fetchDirectorySummary(): Promise<DirectorySummary> {
  const { cities, categories, states } = await fetchDirectoryIndex();
  return {
    totalListings: cities.reduce((sum, c) => sum + c.listingCount, 0),
    cityHubCount: cities.length,
    categoryPageCount: categories.filter(
      (c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS,
    ).length,
    statePageCount: states.length,
  };
}

export async function fetchAllDirectoryCities(): Promise<DirectoryCityRef[]> {
  const { cities } = await fetchDirectoryIndex();
  return cities;
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

  const { cities } = await fetchDirectoryIndex();
  if (!cities.some((c) => c.citySlug === citySlug.toLowerCase())) {
    return null;
  }

  const rows = await fetchAllNoWebsiteRows();
  return rows
    .filter(
      (row) =>
        cityStateToSlug(row.city ?? "", row.state ?? "") ===
        citySlug.toLowerCase(),
    )
    .map(rowToBusiness)
    .sort(sortByReviewsDesc);
}

export async function fetchCityHub(citySlug: string): Promise<{
  city: string;
  state: string;
  listingCount: number;
  categories: DirectoryCategoryRef[];
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
      .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
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
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  lastUpdatedLabel: string | null;
  publishedCitySlugs: Set<string>;
} | null> {
  const canonical = canonicalCategoryFromSlug(categorySlug);
  if (!canonical) return null;

  const index = await fetchDirectoryIndex();
  const categoryRef = index.categories.find(
    (c) => c.categorySlug === canonical.slug,
  );
  if (
    !categoryRef ||
    categoryRef.totalCount < DIRECTORY_MIN_CATEGORY_LISTINGS
  ) {
    return null;
  }

  const rows = await fetchAllNoWebsiteRows();
  const matched = rows.filter((row) =>
    resolveCanonicalCategoryForRow(row.main_category, row.business_type)?.slug ===
    canonical.slug,
  );
  const businesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);

  if (businesses.length < DIRECTORY_MIN_CATEGORY_LISTINGS) return null;

  const cityGroups = groupBusinessesByCity(businesses);

  return {
    categoryLabel: canonical.label,
    businesses,
    cityGroups,
    cityCount: cityGroups.length,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
    publishedCitySlugs: index.publishedCitySlugs,
  };
}

export async function fetchStateListings(
  stateSlug: string,
): Promise<{
  state: string;
  businesses: DirectoryBusiness[];
  cityGroups: DirectoryCityGroup[];
  cityCount: number;
  listingCount: number;
  lastUpdatedLabel: string | null;
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
    (row) => stateToAbbr(row.state ?? "") === parsed.stateAbbr,
  );
  const businesses = matched.map(rowToBusiness).sort(sortByReviewsDesc);

  if (businesses.length < DIRECTORY_MIN_STATE_LISTINGS) return null;

  const cityGroups = groupBusinessesByCity(businesses);

  return {
    state: stateRef.state,
    businesses,
    cityGroups,
    cityCount: cityGroups.length,
    listingCount: businesses.length,
    lastUpdatedLabel: formatLastUpdatedMonthYear(maxFreshnessIso(matched)),
    publishedCitySlugs: index.publishedCitySlugs,
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
