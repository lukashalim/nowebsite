import { cache } from "react";
import { COUNTRY_US, parseDirectoryCountry } from "@/lib/directory/country";
import {
  businessTypeTokensForCategorySlug,
  canonicalCategorySlug,
} from "@/lib/directory/category-merge";
import {
  categoryMatchesSlug,
  stateAbbrToDisplayName,
  stateToAbbr,
} from "@/lib/directory/slugs";
import { DIRECTORY_LIST_COLUMNS } from "@/lib/directory/types";
import { type RawDirectoryRow } from "@/lib/directory/rows";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

interface DirectoryQuery {
  eq(column: string, value: string | boolean): DirectoryQuery;
  not(column: string, operator: string, value: null): DirectoryQuery;
  or(filters: string): DirectoryQuery;
  in(column: string, values: string[]): DirectoryQuery;
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

function applyUsDirectoryBase(q: DirectoryQuery): DirectoryQuery {
  return q
    .eq("has_website", false)
    .not("city", "is", null)
    .not("state", "is", null)
    .or(`country.eq.${COUNTRY_US},country.is.null`);
}

export function stateValuesForQuery(stateAbbr: string): string[] {
  const abbr = stateAbbr.trim().toLowerCase();
  const displayName = stateAbbrToDisplayName(abbr);
  return [...new Set([abbr, abbr.toUpperCase(), displayName])];
}

async function fetchDirectoryRowsBatched(
  applyScope: (q: DirectoryQuery) => DirectoryQuery,
): Promise<RawDirectoryRow[]> {
  const supabase = createSupabaseAdmin();
  const rows: RawDirectoryRow[] = [];
  let from = 0;

  while (true) {
    let q = supabase.from("businesses_nowebsite").select(
      DIRECTORY_LIST_COLUMNS,
    ) as unknown as DirectoryQuery;
    q = applyUsDirectoryBase(q);
    q = applyScope(q);

    const { data, error } = await q
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

export const fetchDirectoryRowsForStateAbbr = cache(
  async (stateAbbr: string): Promise<RawDirectoryRow[]> => {
    const values = stateValuesForQuery(stateAbbr);
    return fetchDirectoryRowsBatched((q) => q.in("state", values));
  },
);

export const fetchDirectoryRowsForCity = cache(
  async (city: string, state: string): Promise<RawDirectoryRow[]> => {
    const cityTrim = city.trim();
    const stateTrim = state.trim();
    if (!cityTrim || !stateTrim) return [];

    const abbr = stateToAbbr(stateTrim);
    const stateValues = abbr
      ? stateValuesForQuery(abbr)
      : [...new Set([stateTrim, stateTrim.toLowerCase(), stateTrim.toUpperCase()])];

    return fetchDirectoryRowsBatched((q) =>
      q.eq("city", cityTrim).in("state", stateValues),
    );
  },
);

export const fetchDirectoryRowsForCategorySlug = cache(
  async (categorySlug: string): Promise<RawDirectoryRow[]> => {
    const slug = canonicalCategorySlug(categorySlug.trim().toLowerCase());

    const bySlugColumn = await fetchDirectoryRowsBatched((q) =>
      q.eq("directory_category_slug", slug),
    );
    if (bySlugColumn.length > 0) {
      return bySlugColumn.filter(
        (row) =>
          parseDirectoryCountry(row.country) === COUNTRY_US &&
          categoryMatchesSlug(row.main_category, row.business_type, slug),
      );
    }

    const tokens = businessTypeTokensForCategorySlug(slug);
    const mainCategoryPattern = slug.replace(/-/g, " ");

    const candidates = await fetchDirectoryRowsBatched((q) => {
      if (tokens.length === 0) {
        return q.ilike("main_category", `%${mainCategoryPattern}%`);
      }
      return q.or(
        `business_type.in.(${tokens.join(",")}),main_category.ilike.%${mainCategoryPattern}%`,
      );
    });

    return candidates.filter(
      (row) =>
        parseDirectoryCountry(row.country) === COUNTRY_US &&
        categoryMatchesSlug(row.main_category, row.business_type, slug),
    );
  },
);
