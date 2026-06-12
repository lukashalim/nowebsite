import { COUNTRY_GB, COUNTRY_US } from "@/lib/directory/country";
import { canonicalCategorySlug } from "@/lib/directory/category-merge";
import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import {
  parseCitySlug,
  parseStateSlug,
  stateAbbrToDisplayName,
} from "@/lib/directory/slugs";
import { DIRECTORY_LIST_COLUMNS } from "@/lib/directory/types";
import { type RawDirectoryRow } from "@/lib/directory/rows";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export { stateValuesForQuery } from "@/lib/directory/scoped-rows";
export { gbRegionFilterOr } from "@/lib/directory/gb-scoped-rows";

interface ListingQuery {
  select(
    columns: string,
    options?: { count?: "exact"; head?: boolean },
  ): ListingQuery;
  eq(column: string, value: string | boolean): ListingQuery;
  not(column: string, operator: string, value: null): ListingQuery;
  or(filters: string): ListingQuery;
  in(column: string, values: string[]): ListingQuery;
  ilike(column: string, pattern: string): ListingQuery;
  gte(column: string, value: number): ListingQuery;
  order(
    column: string,
    options: { ascending: boolean },
  ): ListingQuery;
  range(from: number, to: number): Promise<{
    data: RawDirectoryRow[] | null;
    count: number | null;
    error: { message: string } | null;
  }>;
}

function applyUsDirectoryBase(q: ListingQuery): ListingQuery {
  return q
    .eq("has_website", false)
    .not("city", "is", null)
    .not("state", "is", null)
    .or(`country.eq.${COUNTRY_US},country.is.null`);
}

function applyGbDirectoryBase(q: ListingQuery): ListingQuery {
  return q
    .eq("has_website", false)
    .not("city", "is", null)
    .not("state", "is", null)
    .eq("country", COUNTRY_GB);
}

function applyListingFilters(
  q: ListingQuery,
  filters: DirectoryListingFilters,
  opts?: {
    fixedStateSlug?: string | null;
    stateValues?: string[];
  },
): ListingQuery {
  if (filters.minReviews > 0) {
    q = q.gte("reviews", filters.minReviews);
  }

  const stateSlug = opts?.fixedStateSlug ?? filters.stateSlug;
  if (stateSlug) {
    const parsed = parseStateSlug(stateSlug);
    if (parsed) {
      const values =
        opts?.stateValues ??
        (() => {
          const abbr = parsed.stateAbbr;
          return [
            abbr,
            abbr.toUpperCase(),
            stateAbbrToDisplayName(abbr),
          ];
        })();
      q = q.in("state", [...new Set(values)]);
    }
  }

  if (filters.citySlug) {
    const parsed = parseCitySlug(filters.citySlug);
    if (parsed?.country === COUNTRY_US) {
      q = q.ilike("city", parsed.cityPattern);
    }
  }

  return q;
}

export type DirectoryListingScope =
  | { kind: "state"; stateValues: string[] }
  | { kind: "facebook" }
  | { kind: "category"; categorySlug: string }
  | { kind: "city"; city: string; stateValues: string[] }
  | {
      kind: "gb_region";
      regionSlug: string;
      regionFilter: string;
    }
  | {
      kind: "gb_city";
      city: string;
      regionSlug: string;
      regionFilter: string;
    }
  | {
      kind: "gb_city_category";
      city: string;
      regionSlug: string;
      regionFilter: string;
      categorySlug: string;
    };

export interface ScopedListingPageResult {
  rows: RawDirectoryRow[];
  totalCount: number;
}

export async function fetchScopedListingPage(
  scope: DirectoryListingScope,
  opts: {
    page: number;
    pageSize: number;
    filters: DirectoryListingFilters;
    fixedStateSlug?: string | null;
  },
): Promise<ScopedListingPageResult> {
  const supabase = createSupabaseAdmin();
  const page = Math.max(1, opts.page);
  const pageSize = Math.max(1, opts.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("businesses_nowebsite")
    .select(DIRECTORY_LIST_COLUMNS, { count: "exact" }) as unknown as ListingQuery;

  switch (scope.kind) {
    case "state":
      q = applyUsDirectoryBase(q).in("state", scope.stateValues);
      q = applyListingFilters(q, opts.filters, {
        fixedStateSlug: opts.fixedStateSlug,
        stateValues: scope.stateValues,
      });
      break;
    case "facebook":
      q = applyUsDirectoryBase(q).eq("crm_contact_surface", "facebook");
      q = applyListingFilters(q, opts.filters);
      break;
    case "category": {
      const slug = canonicalCategorySlug(scope.categorySlug.trim().toLowerCase());
      q = applyUsDirectoryBase(q).eq("directory_category_slug", slug);
      q = applyListingFilters(q, opts.filters);
      break;
    }
    case "city":
      q = applyUsDirectoryBase(q)
        .eq("city", scope.city.trim())
        .in("state", scope.stateValues);
      q = applyListingFilters(q, opts.filters, {
        stateValues: scope.stateValues,
      });
      break;
    case "gb_region":
      q = applyGbDirectoryBase(q).or(scope.regionFilter);
      break;
    case "gb_city":
      q = applyGbDirectoryBase(q)
        .or(scope.regionFilter)
        .eq("city", scope.city.trim());
      break;
    case "gb_city_category":
      q = applyGbDirectoryBase(q)
        .or(scope.regionFilter)
        .eq("city", scope.city.trim())
        .eq(
          "directory_category_slug",
          canonicalCategorySlug(scope.categorySlug.trim().toLowerCase()),
        );
      break;
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }

  const { data, count, error } = await q
    .order("reviews", { ascending: false })
    .order("place_id", { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: (data ?? []) as RawDirectoryRow[],
    totalCount: count ?? 0,
  };
}

export async function fetchScopedUnfilteredCount(
  scope: DirectoryListingScope,
): Promise<number> {
  const supabase = createSupabaseAdmin();
  let q = supabase
    .from("businesses_nowebsite")
    .select("place_id", { count: "exact", head: true }) as unknown as ListingQuery;

  switch (scope.kind) {
    case "state":
      q = applyUsDirectoryBase(q).in("state", scope.stateValues);
      break;
    case "facebook":
      q = applyUsDirectoryBase(q).eq("crm_contact_surface", "facebook");
      break;
    case "category":
      q = applyUsDirectoryBase(q).eq(
        "directory_category_slug",
        canonicalCategorySlug(scope.categorySlug.trim().toLowerCase()),
      );
      break;
    case "city":
      q = applyUsDirectoryBase(q)
        .eq("city", scope.city.trim())
        .in("state", scope.stateValues);
      break;
    case "gb_region":
      q = applyGbDirectoryBase(q).or(scope.regionFilter);
      break;
    case "gb_city":
      q = applyGbDirectoryBase(q).or(scope.regionFilter).eq("city", scope.city.trim());
      break;
    case "gb_city_category":
      q = applyGbDirectoryBase(q)
        .or(scope.regionFilter)
        .eq("city", scope.city.trim())
        .eq(
          "directory_category_slug",
          canonicalCategorySlug(scope.categorySlug.trim().toLowerCase()),
        );
      break;
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }

  const { count, error } = await q.range(0, 0);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}
