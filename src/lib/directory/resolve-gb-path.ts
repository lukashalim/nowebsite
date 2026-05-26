import { cache } from "react";
import {
  fetchGbCityCategoryListings,
  fetchGbCityHub,
  fetchGbCityListings,
  fetchGbDirectoryIndex,
  fetchGbRegionListings,
} from "@/lib/directory/gb-data";
import { parseUkRegionSlug } from "@/lib/directory/country";
import { fetchDirectoryIndex } from "@/lib/directory/data";
import { DIRECTORY_MIN_CATEGORY_LISTINGS } from "@/lib/directory/types";
import { legacyGbFlatCitySlug, parseCitySlug } from "@/lib/directory/slugs";
import { gbCityPath, gbRegionPath } from "@/lib/directory/paths";

export type ResolvedGbPath =
  | { kind: "redirect"; to: string }
  | {
      kind: "region";
      data: NonNullable<Awaited<ReturnType<typeof fetchGbRegionListings>>>;
    }
  | {
      kind: "city";
      hub: NonNullable<Awaited<ReturnType<typeof fetchGbCityHub>>>;
      businesses: NonNullable<Awaited<ReturnType<typeof fetchGbCityListings>>>;
    }
  | {
      kind: "cityCategory";
      hub: NonNullable<Awaited<ReturnType<typeof fetchGbCityHub>>>;
      categorySlug: string;
      categoryLabel: string;
      businesses: DirectoryBusiness[];
      listingCount: number;
      lastUpdatedLabel: string | null;
    }
  | { kind: "notFound" };

import type { DirectoryBusiness } from "@/lib/directory/types";

export const resolveGbPath = cache(async function resolveGbPath(
  segments: string[],
): Promise<ResolvedGbPath> {
  const parts = segments.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return { kind: "notFound" };

  if (parts.length === 1) {
    const regionSlug = parts[0]!;
    const uk = parseUkRegionSlug(regionSlug);
    if (!uk) return { kind: "notFound" };
    const data = await fetchGbRegionListings(uk.regionSlug);
    if (!data) return { kind: "notFound" };
    return { kind: "region", data };
  }

  if (parts.length === 2) {
    const [regionSlug, citySlug] = parts;
    const [hub, businesses] = await Promise.all([
      fetchGbCityHub(regionSlug, citySlug),
      fetchGbCityListings(regionSlug, citySlug),
    ]);
    if (!hub || !businesses) return { kind: "notFound" };
    return { kind: "city", hub, businesses };
  }

  if (parts.length === 3) {
    const [regionSlug, citySlug, categorySlug] = parts;
    const hub = await fetchGbCityHub(regionSlug, citySlug);
    if (!hub) return { kind: "notFound" };

    const usIndex = await fetchDirectoryIndex();
    const nationwide = usIndex.categories.find(
      (c) => c.categorySlug === categorySlug,
    );
    if (
      !nationwide ||
      nationwide.totalCount < DIRECTORY_MIN_CATEGORY_LISTINGS
    ) {
      const local = await fetchGbCityCategoryListings(
        regionSlug,
        citySlug,
        categorySlug,
      );
      if (!local) return { kind: "notFound" };
      return {
        kind: "cityCategory",
        hub,
        categorySlug,
        categoryLabel: local.categoryLabel,
        businesses: local.businesses,
        listingCount: local.listingCount,
        lastUpdatedLabel: local.lastUpdatedLabel,
      };
    }

    const local = await fetchGbCityCategoryListings(
      regionSlug,
      citySlug,
      categorySlug,
    );
    if (!local) return { kind: "notFound" };
    return {
      kind: "cityCategory",
      hub,
      categorySlug,
      categoryLabel: local.categoryLabel,
      businesses: local.businesses,
      listingCount: local.listingCount,
      lastUpdatedLabel: local.lastUpdatedLabel,
    };
  }

  return { kind: "notFound" };
});

/** Redirect targets for legacy flat UK slugs (`/bristol-gb`, `/england`). */
export async function resolveLegacyGbFlatSlugRedirect(
  slug: string,
): Promise<string | null> {
  const lower = slug.trim().toLowerCase();
  const uk = parseUkRegionSlug(lower);
  if (uk) return gbRegionPath(uk.regionSlug);

  const parsed = parseCitySlug(lower);
  if (parsed?.country !== "GB") return null;

  const { cities } = await fetchGbDirectoryIndex();
  const match = cities.find((c) => legacyGbFlatCitySlug(c.city) === lower);
  if (match?.regionSlug) {
    return gbCityPath(match.regionSlug, match.citySlug);
  }
  return null;
}
