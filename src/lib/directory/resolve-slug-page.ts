import { cache } from "react";
import {
  fetchCityHub,
  fetchCityListings,
  fetchDirectoryIndex,
  fetchNationwideCategoryListings,
  fetchStateListings,
} from "@/lib/directory/data";
import { mergedCategorySlugToCanonical } from "@/lib/directory/category-merge";
import {
  legacyCategorySlugToCanonical,
  parseCitySlug,
  parseStateSlug,
} from "@/lib/directory/slugs";
import { resolveLegacyGbFlatSlugRedirect } from "@/lib/directory/resolve-gb-path";
import { COUNTRY_GB } from "@/lib/directory/country";
import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import type { DirectoryBusiness } from "@/lib/directory/types";

export type ResolvedSlugPage =
  | { kind: "redirect"; to: string }
  | {
      kind: "category";
      data: NonNullable<
        Awaited<ReturnType<typeof fetchNationwideCategoryListings>>
      >;
    }
  | {
      kind: "city";
      hub: NonNullable<Awaited<ReturnType<typeof fetchCityHub>>>;
      businesses: DirectoryBusiness[];
      cityData: NonNullable<Awaited<ReturnType<typeof fetchCityListings>>>;
    }
  | {
      kind: "state";
      data: NonNullable<Awaited<ReturnType<typeof fetchStateListings>>>;
    }
  | { kind: "notFound" };

/**
 * Resolve /[slug] to US city, US state, or nationwide category.
 * UK paths live under /united-kingdom/…; legacy flat UK slugs redirect.
 */
export const resolveDirectorySlugPage = cache(async function resolveDirectorySlugPage(
  slug: string,
  page = 1,
  filters?: DirectoryListingFilters,
): Promise<ResolvedSlugPage> {
  const lower = slug.trim().toLowerCase();

  const legacy = legacyCategorySlugToCanonical(lower);
  if (legacy) return { kind: "redirect", to: legacy };

  const merged = mergedCategorySlugToCanonical(lower);
  if (merged) return { kind: "redirect", to: merged };

  const gbRedirect = await resolveLegacyGbFlatSlugRedirect(lower);
  if (gbRedirect) return { kind: "redirect", to: gbRedirect };

  const parsedCity = parseCitySlug(lower);
  if (parsedCity?.country === COUNTRY_GB) {
    const to = await resolveLegacyGbFlatSlugRedirect(lower);
    if (to) return { kind: "redirect", to };
    return { kind: "notFound" };
  }

  const index = await fetchDirectoryIndex();
  const categoryRef = index.categories.find((c) => c.categorySlug === lower);
  if (categoryRef) {
    const categoryData = await fetchNationwideCategoryListings(lower, {
      page,
      filters,
    });
    if (categoryData) return { kind: "category", data: categoryData };
  }

  if (parseCitySlug(lower)) {
    const [hub, cityData] = await Promise.all([
      fetchCityHub(lower),
      fetchCityListings(lower, { filters }),
    ]);
    if (hub && cityData)
      return { kind: "city", hub, businesses: cityData.businesses, cityData };
  }

  if (parseStateSlug(lower)) {
    const data = await fetchStateListings(lower, { page, filters });
    if (data) return { kind: "state", data };
  }

  return { kind: "notFound" };
});
