import {
  categoryLabelToSlug,
  cityStateToSlug,
  isPlaceholderBusinessType,
} from "@/lib/directory/slugs";
import { DIRECTORY_MIN_LISTINGS } from "@/lib/directory/types";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

interface SitemapRow {
  city: string | null;
  state: string | null;
  business_type: string | null;
  scraped_at: string | null;
}

export interface SitemapCityCategoryGroup {
  citySlug: string;
  categorySlug: string;
  count: number;
  lastModified: Date;
}

export interface SitemapData {
  homepageLastModified: Date;
  cityHubs: { citySlug: string; lastModified: Date }[];
  cityCategories: SitemapCityCategoryGroup[];
}

function parseScrapedAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

async function fetchSitemapRows(): Promise<SitemapRow[]> {
  const supabase = createSupabaseAdmin();
  const rows: SitemapRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("businesses_nowebsite")
      .select("city, state, business_type, scraped_at")
      .eq("has_website", false)
      .not("city", "is", null)
      .not("state", "is", null)
      .not("business_type", "is", null)
      .range(from, from + BATCH - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as SitemapRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return rows;
}

/**
 * Aggregates city + business_type groups with count >= 5 (matches SQL GROUP BY).
 * lastModified = max(scraped_at) per group.
 */
export async function fetchSitemapData(): Promise<SitemapData> {
  const rows = await fetchSitemapRows();
  const groupMap = new Map<
    string,
    { citySlug: string; categorySlug: string; count: number; lastModified: Date | null }
  >();
  const cityHubMod = new Map<string, Date | null>();
  let globalLastMod: Date | null = null;

  for (const row of rows) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    const businessType = row.business_type?.trim();
    if (!city || !state || !businessType || isPlaceholderBusinessType(businessType)) {
      continue;
    }

    const citySlug = cityStateToSlug(city, state);
    if (!citySlug) continue;

    const categorySlug = categoryLabelToSlug(businessType);
    const scraped = parseScrapedAt(row.scraped_at);
    globalLastMod = maxDate(globalLastMod, scraped);
    cityHubMod.set(citySlug, maxDate(cityHubMod.get(citySlug) ?? null, scraped));

    const key = `${citySlug}::${categorySlug}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastModified = maxDate(existing.lastModified, scraped);
    } else {
      groupMap.set(key, {
        citySlug,
        categorySlug,
        count: 1,
        lastModified: scraped,
      });
    }
  }

  const cityCategories: SitemapCityCategoryGroup[] = [];
  for (const g of groupMap.values()) {
    if (g.count < DIRECTORY_MIN_LISTINGS) continue;
    cityCategories.push({
      citySlug: g.citySlug,
      categorySlug: g.categorySlug,
      count: g.count,
      lastModified: g.lastModified ?? new Date(),
    });
  }

  const citySlugsInCategories = new Set(cityCategories.map((c) => c.citySlug));
  const cityHubs = [...citySlugsInCategories].map((citySlug) => ({
    citySlug,
    lastModified: cityHubMod.get(citySlug) ?? new Date(),
  }));

  return {
    homepageLastModified: globalLastMod ?? new Date(),
    cityHubs,
    cityCategories,
  };
}
