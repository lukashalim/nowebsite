import type { MetadataRoute } from "next";
import { fetchDirectoryIndex } from "@/lib/directory/data";
import {
  DIRECTORY_MIN_CATEGORY_LISTINGS,
  DIRECTORY_MIN_CITY_LISTINGS,
  DIRECTORY_MIN_STATE_LISTINGS,
} from "@/lib/directory/types";

const SITE_ORIGIN = "https://nowebsitebusinessleads.com";

/** Regenerate on each request so Vercel always has Supabase env at runtime. */
export const dynamic = "force-dynamic";

function toLastModified(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { cities, categories, states, homepageLastModified } =
      await fetchDirectoryIndex();

    const entries: MetadataRoute.Sitemap = [
      {
        url: `${SITE_ORIGIN}/`,
        lastModified: homepageLastModified ?? new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
      {
        url: `${SITE_ORIGIN}/cities`,
        lastModified: homepageLastModified ?? new Date(),
        changeFrequency: "weekly",
        priority: 0.85,
      },
      {
        url: `${SITE_ORIGIN}/categories`,
        lastModified: homepageLastModified ?? new Date(),
        changeFrequency: "weekly",
        priority: 0.85,
      },
      {
        url: `${SITE_ORIGIN}/states`,
        lastModified: homepageLastModified ?? new Date(),
        changeFrequency: "weekly",
        priority: 0.85,
      },
      ...cities
        .filter((hub) => hub.listingCount >= DIRECTORY_MIN_CITY_LISTINGS)
        .map((hub) => ({
          url: `${SITE_ORIGIN}/${hub.citySlug}`,
          lastModified: toLastModified(hub.lastModifiedAt),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        })),
      ...categories
        .filter((c) => c.totalCount >= DIRECTORY_MIN_CATEGORY_LISTINGS)
        .map((cat) => ({
          url: `${SITE_ORIGIN}/${cat.categorySlug}`,
          lastModified: homepageLastModified ?? new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
      ...states
        .filter((s) => s.listingCount >= DIRECTORY_MIN_STATE_LISTINGS)
        .map((state) => ({
          url: `${SITE_ORIGIN}/${state.stateSlug}`,
          lastModified: toLastModified(state.lastModifiedAt),
          changeFrequency: "weekly" as const,
          priority: 0.75,
        })),
    ];

    return entries;
  } catch (err) {
    console.error("[sitemap] fetchDirectoryIndex failed:", err);
    return [
      {
        url: `${SITE_ORIGIN}/`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
    ];
  }
}
