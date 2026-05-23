import type { MetadataRoute } from "next";
import { fetchDirectoryIndex } from "@/lib/directory/data";

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
    const { cities, cityCategories, homepageLastModified } =
      await fetchDirectoryIndex();

    const entries: MetadataRoute.Sitemap = [
      {
        url: `${SITE_ORIGIN}/`,
        lastModified: homepageLastModified ?? new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
      ...cities.map((hub) => ({
        url: `${SITE_ORIGIN}/${hub.citySlug}`,
        lastModified: toLastModified(hub.lastModifiedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...cityCategories.map((group) => ({
        url: `${SITE_ORIGIN}/${group.citySlug}/${group.categorySlug}`,
        lastModified: toLastModified(group.lastModifiedAt),
        changeFrequency: "weekly" as const,
        priority: 0.7,
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
