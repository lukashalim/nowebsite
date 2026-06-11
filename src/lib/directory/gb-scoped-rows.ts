import { cache } from "react";
import {
  COUNTRY_GB,
  UK_REGION_SLUG_TO_NAME,
} from "@/lib/directory/country";
import {
  businessTypeTokensForCategorySlug,
  canonicalCategorySlug,
} from "@/lib/directory/category-merge";
import { categoryMatchesSlug } from "@/lib/directory/slugs";
import { DIRECTORY_LIST_COLUMNS } from "@/lib/directory/types";
import { type RawDirectoryRow } from "@/lib/directory/rows";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

interface DirectoryQuery {
  eq(column: string, value: string | boolean): DirectoryQuery;
  not(column: string, operator: string, value: null): DirectoryQuery;
  or(filters: string): DirectoryQuery;
  ilike(column: string, pattern: string): DirectoryQuery;
  order(
    column: string,
    options: { ascending: boolean },
  ): DirectoryQuery;
  range(from: number, to: number): Promise<{
    data: RawDirectoryRow[] | null;
    error: { message: string } | null;
  }>;
}

function applyGbDirectoryBase(q: DirectoryQuery): DirectoryQuery {
  return q
    .eq("has_website", false)
    .not("city", "is", null)
    .not("state", "is", null)
    .eq("country", COUNTRY_GB);
}

function applyGbRegionScope(
  q: DirectoryQuery,
  regionSlug: string,
): DirectoryQuery | null {
  const slug = regionSlug.trim().toLowerCase();
  const regionName = UK_REGION_SLUG_TO_NAME[slug];
  if (!regionName) return null;

  return q.or(
    `region_code.eq.${slug},state.eq.${regionName},state.ilike.${regionName}`,
  );
}

async function fetchGbDirectoryRowsBatched(
  applyScope: (q: DirectoryQuery) => DirectoryQuery | null,
): Promise<RawDirectoryRow[]> {
  const supabase = createSupabaseAdmin();
  const rows: RawDirectoryRow[] = [];
  let from = 0;

  while (true) {
    const base = applyGbDirectoryBase(
      supabase.from("businesses_nowebsite").select(
        DIRECTORY_LIST_COLUMNS,
      ) as unknown as DirectoryQuery,
    );
    const scoped = applyScope(base);
    if (!scoped) return [];

    const { data, error } = await scoped
      .order("reviews", { ascending: false })
      .order("place_id", { ascending: true })
      .range(from, from + BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as RawDirectoryRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return rows;
}

export const fetchGbDirectoryRowsForRegion = cache(
  async (regionSlug: string): Promise<RawDirectoryRow[]> => {
    return fetchGbDirectoryRowsBatched((q) => applyGbRegionScope(q, regionSlug));
  },
);

export const fetchGbDirectoryRowsForCity = cache(
  async (
    city: string,
    regionSlug: string,
  ): Promise<RawDirectoryRow[]> => {
    const cityTrim = city.trim();
    if (!cityTrim || !regionSlug.trim()) return [];

    return fetchGbDirectoryRowsBatched((q) => {
      const scoped = applyGbRegionScope(q, regionSlug);
      if (!scoped) return null;
      return scoped.eq("city", cityTrim);
    });
  },
);

export const fetchGbDirectoryRowsForCityCategory = cache(
  async (
    city: string,
    regionSlug: string,
    categorySlug: string,
  ): Promise<RawDirectoryRow[]> => {
    const slug = canonicalCategorySlug(categorySlug.trim().toLowerCase());
    const rows = await fetchGbDirectoryRowsForCity(city, regionSlug);
    return rows.filter((row) =>
      categoryMatchesSlug(row.main_category, row.business_type, slug),
    );
  },
);

/** Broad candidate fetch for a nationwide GB category (post-filter in app). */
export const fetchGbDirectoryRowsForCategorySlug = cache(
  async (categorySlug: string): Promise<RawDirectoryRow[]> => {
    const slug = canonicalCategorySlug(categorySlug.trim().toLowerCase());
    const tokens = businessTypeTokensForCategorySlug(slug);
    const mainCategoryPattern = slug.replace(/-/g, " ");

    const candidates = await fetchGbDirectoryRowsBatched((q) => {
      if (tokens.length === 0) {
        return q.ilike("main_category", `%${mainCategoryPattern}%`);
      }
      return q.or(
        `business_type.in.(${tokens.join(",")}),main_category.ilike.%${mainCategoryPattern}%`,
      );
    });

    return candidates.filter((row) =>
      categoryMatchesSlug(row.main_category, row.business_type, slug),
    );
  },
);
