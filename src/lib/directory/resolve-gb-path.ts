import { cache } from "react";
import {
  fetchGbCityHub,
  fetchGbCityListings,
  fetchGbDirectoryIndex,
  fetchGbRegionListings,
} from "@/lib/directory/gb-data";
import { parseUkRegionSlug } from "@/lib/directory/country";
import { fetchDirectoryIndex } from "@/lib/directory/data";
import { DIRECTORY_MIN_CATEGORY_LISTINGS } from "@/lib/directory/types";
import { categoryPath } from "@/lib/directory/labels";
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
  | { kind: "notFound" };

async function redirectForUkCategorySlug(
  categorySlug: string,
  fallbackPath: string,
): Promise<ResolvedGbPath> {
  const usIndex = await fetchDirectoryIndex();
  const nationwide = usIndex.categories.find(
    (c) => c.categorySlug === categorySlug,
  );
  if (
    nationwide &&
    nationwide.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS
  ) {
    return { kind: "redirect", to: categoryPath(categorySlug) };
  }
  return { kind: "redirect", to: fallbackPath };
}

/**
 * UK URLs:
 * - /united-kingdom/{region} — region hub
 * - /united-kingdom/{city} — city hub
 * No /united-kingdom/{city}/{category} (use nationwide /{category} instead).
 * Legacy nested paths redirect.
 */
export const resolveGbPath = cache(async function resolveGbPath(
  segments: string[],
): Promise<ResolvedGbPath> {
  const parts = segments.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return { kind: "notFound" };

  if (parts.length === 1) {
    const seg = parts[0]!;
    const uk = parseUkRegionSlug(seg);
    if (uk) {
      const data = await fetchGbRegionListings(uk.regionSlug);
      if (!data) return { kind: "notFound" };
      return { kind: "region", data };
    }

    const [hub, businesses] = await Promise.all([
      fetchGbCityHub(seg),
      fetchGbCityListings(seg),
    ]);
    if (!hub || !businesses) return { kind: "notFound" };
    return { kind: "city", hub, businesses };
  }

  if (parts.length === 2) {
    const [a, b] = parts;
    if (parseUkRegionSlug(a!)) {
      return { kind: "redirect", to: gbCityPath(b!) };
    }
    return redirectForUkCategorySlug(b!, gbCityPath(a!));
  }

  if (parts.length === 3) {
    const [regionSeg, citySlug, categorySlug] = parts;
    if (parseUkRegionSlug(regionSeg!)) {
      return redirectForUkCategorySlug(categorySlug!, gbCityPath(citySlug!));
    }
    return { kind: "notFound" };
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
  if (match) {
    return gbCityPath(match.citySlug);
  }
  return null;
}
