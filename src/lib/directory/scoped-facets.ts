import { COUNTRY_US } from "@/lib/directory/country";
import type { DirectoryFilterOptions } from "@/lib/directory/listing-filters";
import {
  cityStateToSlug,
  isUsStateForDirectory,
  stateAbbrToDisplayName,
  stateNameToSlug,
  stateToAbbr,
} from "@/lib/directory/slugs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

interface FacetRow {
  state: string;
  city: string;
  listing_count: number;
}

function mapFacetRowsToFilterOptions(rows: FacetRow[]): DirectoryFilterOptions {
  const stateCounts = new Map<
    string,
    { label: string; count: number }
  >();
  const cityCounts = new Map<
    string,
    Map<string, { city: string; count: number }>
  >();

  for (const row of rows) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    if (!city || !state) continue;

    const stateSlug = stateNameToSlug(state);
    if (!stateSlug || !isUsStateForDirectory(state)) continue;

    const citySlug = cityStateToSlug(city, state, COUNTRY_US);
    if (!citySlug) continue;

    const count = Number(row.listing_count) || 0;
    if (count <= 0) continue;

    const stateEntry = stateCounts.get(stateSlug);
    if (stateEntry) {
      stateEntry.count += count;
    } else {
      stateCounts.set(stateSlug, {
        label: stateAbbrToDisplayName(stateToAbbr(state) ?? state),
        count,
      });
    }

    let byCity = cityCounts.get(stateSlug);
    if (!byCity) {
      byCity = new Map();
      cityCounts.set(stateSlug, byCity);
    }
    const cityEntry = byCity.get(citySlug);
    if (cityEntry) {
      cityEntry.count += count;
    } else {
      byCity.set(citySlug, { city, count });
    }
  }

  const states = [...stateCounts.entries()]
    .map(([stateSlug, { label, count }]) => ({ stateSlug, label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const citiesByStateSlug: DirectoryFilterOptions["citiesByStateSlug"] = {};
  for (const [stateSlug, cities] of cityCounts) {
    citiesByStateSlug[stateSlug] = [...cities.entries()]
      .map(([citySlug, { city, count }]) => ({ citySlug, city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
  }

  return { states, citiesByStateSlug };
}

export async function fetchUsStateFacetOptions(
  stateValues: string[],
): Promise<DirectoryFilterOptions> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_us_state_facet_index", {
    p_state_values: stateValues,
  });
  if (error) {
    throw new Error(error.message);
  }
  return mapFacetRowsToFilterOptions(
    (data ?? []).map((row: Record<string, unknown>) => ({
      state: String(row.state ?? ""),
      city: String(row.city ?? ""),
      listing_count: Number(row.listing_count ?? 0),
    })),
  );
}

export async function fetchUsFacebookFacetOptions(): Promise<DirectoryFilterOptions> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_us_facebook_facet_index");
  if (error) {
    throw new Error(error.message);
  }
  return mapFacetRowsToFilterOptions(
    (data ?? []).map((row: Record<string, unknown>) => ({
      state: String(row.state ?? ""),
      city: String(row.city ?? ""),
      listing_count: Number(row.listing_count ?? 0),
    })),
  );
}

export async function fetchUsCategoryFacetOptions(
  categorySlug: string,
): Promise<DirectoryFilterOptions> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_us_category_facet_index", {
    p_category_slug: categorySlug.trim().toLowerCase(),
  });
  if (error) {
    throw new Error(error.message);
  }
  return mapFacetRowsToFilterOptions(
    (data ?? []).map((row: Record<string, unknown>) => ({
      state: String(row.state ?? ""),
      city: String(row.city ?? ""),
      listing_count: Number(row.listing_count ?? 0),
    })),
  );
}

export async function fetchGbRegionFacetOptions(
  regionSlug: string,
): Promise<{ cities: { city: string; state: string; count: number }[] }> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("directory_gb_region_facet_index", {
    p_region_code: regionSlug.trim().toLowerCase(),
  });
  if (error) {
    throw new Error(error.message);
  }
  const cities = (data ?? [])
    .map((row: Record<string, unknown>) => ({
      city: String(row.city ?? ""),
      state: String(row.state ?? ""),
      count: Number(row.listing_count ?? 0),
    }))
    .filter(
      (row: { city: string; state: string; count: number }) =>
        row.city && row.count > 0,
    )
    .sort(
      (
        a: { city: string; state: string; count: number },
        b: { city: string; state: string; count: number },
      ) => b.count - a.count || a.city.localeCompare(b.city),
    );
  return { cities };
}
