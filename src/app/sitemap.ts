import type { MetadataRoute } from "next";
import { fetchDirectoryIndex, fetchUkDirectoryIndex } from "@/lib/directory/data";
import {
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_CITY_LISTINGS,
  DIRECTORY_MIN_STATE_LISTINGS,
  DIRECTORY_MIN_UK_REGION_LISTINGS,
} from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";

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
  try {
    const [{ cities, categories, states, homepageLastModified }, ukIndex] =
      await Promise.all([fetchDirectoryIndex(), fetchUkDirectoryIndex()]);

    const hubLastModified = homepageLastModified ?? new Date();
    const ukHubLastModified =
      ukIndex.lastModified ?? homepageLastModified ?? new Date();

    const entries: MetadataRoute.Sitemap = [
      hubEntry("/", hubLastModified, 1.0),
      hubEntry("/cities", hubLastModified, 0.85),
      hubEntry("/categories", hubLastModified, 0.85),
      hubEntry("/states", hubLastModified, 0.85),
      hubEntry("/facebook", hubLastModified, 0.8),
      hubEntry("/uk", ukHubLastModified, 0.85),
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
      ...ukIndex.cities
        .filter((c) => c.listingCount >= DIRECTORY_MIN_CITY_LISTINGS)
        .map((hub) => ({
          url: absoluteUrl(`/${hub.citySlug}`),
          lastModified: toLastModified(hub.lastModifiedAt),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        })),
      ...ukIndex.regions
        .filter((r) => r.listingCount >= DIRECTORY_MIN_UK_REGION_LISTINGS)
        .map((region) => ({
          url: absoluteUrl(`/${region.regionSlug}`),
          lastModified: toLastModified(region.lastModifiedAt),
          changeFrequency: "weekly" as const,
          priority: 0.75,
        })),
    ];

    return entries;
  } catch (err) {
    console.error("[sitemap] fetchDirectoryIndex failed:", err);
    return [hubEntry("/", new Date(), 1.0)];
  }
}
