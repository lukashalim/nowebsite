import { cache } from "react";
import {
  fetchCityHub,
  fetchCityListings,
  fetchNationwideCategoryListings,
  fetchStateListings,
  fetchUkRegionListings,
} from "@/lib/directory/data";
import {
  legacyCategorySlugToCanonical,
  parseCitySlug,
  parseStateSlug,
  parseUkRegionSlug,
} from "@/lib/directory/slugs";

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
      businesses: NonNullable<Awaited<ReturnType<typeof fetchCityListings>>>;
    }
  | {
      kind: "state";
      data: NonNullable<Awaited<ReturnType<typeof fetchStateListings>>>;
    }
  | {
      kind: "ukRegion";
      data: NonNullable<Awaited<ReturnType<typeof fetchUkRegionListings>>>;
    }
  | { kind: "notFound" };

/**
 * Resolve /[slug] to city, state, UK region, or nationwide category.
 * Category is checked before city so slugs like `repair-pa` are not treated as a city hub.
 */
export const resolveDirectorySlugPage = cache(async function resolveDirectorySlugPage(
  slug: string,
): Promise<ResolvedSlugPage> {
  const lower = slug.trim().toLowerCase();

  const legacy = legacyCategorySlugToCanonical(lower);
  if (legacy) return { kind: "redirect", to: legacy };

  const categoryData = await fetchNationwideCategoryListings(lower);
  if (categoryData) return { kind: "category", data: categoryData };

  const ukRegion = parseUkRegionSlug(lower);
  if (ukRegion) {
    const data = await fetchUkRegionListings(ukRegion.regionSlug);
    if (data) return { kind: "ukRegion", data };
  }

  if (parseCitySlug(lower)) {
    const [hub, businesses] = await Promise.all([
      fetchCityHub(lower),
      fetchCityListings(lower),
    ]);
    if (hub && businesses) return { kind: "city", hub, businesses };
  }

  if (parseStateSlug(lower)) {
    const data = await fetchStateListings(lower);
    if (data) return { kind: "state", data };
  }

  return { kind: "notFound" };
});
