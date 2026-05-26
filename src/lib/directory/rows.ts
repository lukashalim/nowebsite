import { cache } from "react";
import { parseDirectoryCountry } from "@/lib/directory/country";
import { cityNameToSlug, cityStateToSlug } from "@/lib/directory/slugs";
import { COUNTRY_GB } from "@/lib/directory/country";
import type { DirectoryBusiness, DirectoryCityGroup } from "@/lib/directory/types";
import { DIRECTORY_LIST_COLUMNS } from "@/lib/directory/types";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

export interface RawDirectoryRow {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  region_code: string | null;
  country: string | null;
  business_type: string | null;
  main_category: string | null;
  rating: number | null;
  reviews: number | null;
  phone: string | null;
  google_maps_link: string | null;
  demo_slug: string | null;
  last_checked: string | null;
  scraped_at: string | null;
}

export type ListingFreshnessRow = Pick<
  RawDirectoryRow,
  "last_checked" | "scraped_at"
>;

/** Most recent time this listing was verified in the scrape pipeline. */
export function listingCheckedAtIso(row: ListingFreshnessRow): string | null {
  return row.last_checked ?? row.scraped_at;
}

export function rowToBusiness(row: RawDirectoryRow): DirectoryBusiness {
  return {
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    region: row.region?.trim() || null,
    regionCode: row.region_code?.trim().toLowerCase() || null,
    country: parseDirectoryCountry(row.country),
    business_type: row.business_type,
    main_category: row.main_category,
    rating: row.rating,
    reviews: row.reviews,
    phone: row.phone,
    google_maps_link: row.google_maps_link,
    demo_slug: row.demo_slug,
    checkedAt: listingCheckedAtIso(row),
  };
}

export function maxFreshnessIso(rows: ListingFreshnessRow[]): string | null {
  let max: string | null = null;
  for (const row of rows) {
    const t = listingCheckedAtIso(row);
    if (!t) continue;
    if (!max || t > max) max = t;
  }
  return max;
}

export function bumpFreshnessIso(
  current: string | null,
  row: ListingFreshnessRow,
): string | null {
  const t = listingCheckedAtIso(row);
  if (!t) return current;
  if (!current || t > current) return t;
  return current;
}

export function sortByReviewsDesc(a: DirectoryBusiness, b: DirectoryBusiness): number {
  return (b.reviews ?? 0) - (a.reviews ?? 0);
}

export const fetchAllNoWebsiteRows = cache(async (): Promise<RawDirectoryRow[]> => {
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
      const hint = /country|region|schema cache/i.test(error.message)
        ? " Run scrape/sql migrations for businesses_nowebsite (country, region)."
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

export function groupBusinessesByCity(
  businesses: DirectoryBusiness[],
): DirectoryCityGroup[] {
  const groups = new Map<string, DirectoryCityGroup>();

  for (const b of businesses) {
    const city = b.city?.trim();
    const state = b.state?.trim();
    if (!city || !state) continue;

    const region = b.region?.trim() || state;

    let citySlug: string | null;
    let key: string;

    if (b.country === COUNTRY_GB && b.regionCode) {
      const nested = cityNameToSlug(city);
      if (!nested) continue;
      citySlug = nested;
      key = `${b.regionCode}::${nested}`;
    } else {
      citySlug = cityStateToSlug(city, state, b.country);
      if (!citySlug) continue;
      key = citySlug;
    }

    const existing = groups.get(key);
    if (existing) {
      existing.businesses.push(b);
    } else {
      groups.set(key, {
        city,
        state,
        region,
        regionSlug: b.regionCode,
        country: b.country,
        citySlug: citySlug ?? key,
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
