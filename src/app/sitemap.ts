import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { fetchDirectoryIndex, fetchGbDirectoryIndex } from "@/lib/directory/data";
import {
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_CITY_LISTINGS,
  DIRECTORY_MIN_GB_CITY_LISTINGS,
  DIRECTORY_MIN_STATE_LISTINGS,
  DIRECTORY_MIN_UK_REGION_LISTINGS,
} from "@/lib/directory/types";
import {
  gbCityPath,
  gbCountryPath,
  gbRegionPath,
} from "@/lib/directory/paths";
import { absoluteUrl } from "@/lib/site-url";
import { ukRegionNameToSlug } from "@/lib/directory/country";

/** Regenerate on each request so Vercel always has Supabase env at runtime. */
export const dynamic = "force-dynamic";

const MARKETING_PATHS = ["/about", "/contact", "/how-it-works", "/pro"] as const;

function toLastModified(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function hubEntry(
  path: string,
  lastModified: Date,
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: "weekly",
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host") ?? "";
  const isRingReady = host.includes("ringreadysite.com");
  if (isRingReady) {
    // Never expose a sitemap for ringreadysite.com.
    return [];
  }

  try {
    const [{ cities, categories, states, homepageLastModified }, gbIndex] =
      await Promise.all([fetchDirectoryIndex(), fetchGbDirectoryIndex()]);

    const hubLastModified = homepageLastModified ?? new Date();
    const gbHubLastModified = gbIndex.lastModified ?? homepageLastModified ?? new Date();

    const gbCityEntries = gbIndex.cities
      .filter((c) => c.listingCount >= DIRECTORY_MIN_GB_CITY_LISTINGS)
      .filter((c) => c.regionSlug)
      .map((hub) => ({
        url: absoluteUrl(gbCityPath(hub.regionSlug!, hub.citySlug)),
        lastModified: toLastModified(hub.lastModifiedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));

    const gbRegionEntries = gbIndex.regions
      .filter((r) => r.listingCount >= DIRECTORY_MIN_UK_REGION_LISTINGS)
      .map((region) => ({
        url: absoluteUrl(gbRegionPath(region.regionSlug)),
        lastModified: toLastModified(region.lastModifiedAt),
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }));

    const gbCityCategoryEntries: MetadataRoute.Sitemap = gbIndex.cityCategoriesAll
      .filter((cc) => cc.listingCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
      .flatMap((cc) => {
        const regionSlug = ukRegionNameToSlug(cc.state)?.toLowerCase();
        if (!regionSlug) return [];
        return [
          {
            url: absoluteUrl(
              `${gbCountryPath()}/${regionSlug}/${cc.citySlug}/${cc.categorySlug}`,
            ),
            lastModified: toLastModified(cc.lastModifiedAt),
            changeFrequency: "weekly" as const,
            priority: 0.65,
          },
        ];
      });

    const entries: MetadataRoute.Sitemap = [
      hubEntry("/", hubLastModified, 1.0),
      hubEntry("/cities", hubLastModified, 0.85),
      hubEntry("/categories", hubLastModified, 0.85),
      hubEntry("/states", hubLastModified, 0.85),
      hubEntry("/facebook", hubLastModified, 0.8),
      hubEntry(gbCountryPath(), gbHubLastModified, 0.85),
      ...MARKETING_PATHS.map((path) => hubEntry(path, hubLastModified, 0.55)),
      ...cities
        .filter((hub) => hub.listingCount >= DIRECTORY_MIN_CITY_LISTINGS)
        .map((hub) => ({
          url: absoluteUrl(`/${hub.citySlug}`),
          lastModified: toLastModified(hub.lastModifiedAt),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        })),
      ...categories
        .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
        .map((cat) => ({
          url: absoluteUrl(`/${cat.categorySlug}`),
          lastModified: toLastModified(cat.lastModifiedAt),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
      ...states
        .filter((s) => s.listingCount >= DIRECTORY_MIN_STATE_LISTINGS)
        .map((state) => ({
          url: absoluteUrl(`/${state.stateSlug}`),
          lastModified: toLastModified(state.lastModifiedAt),
          changeFrequency: "weekly" as const,
          priority: 0.75,
        })),
      ...gbCityEntries,
      ...gbRegionEntries,
      ...gbCityCategoryEntries,
    ];

    return entries;
  } catch (err) {
    console.error("[sitemap] fetchDirectoryIndex failed:", err);
    return [hubEntry("/", new Date(), 1.0)];
  }
}
