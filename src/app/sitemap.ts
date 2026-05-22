import type { MetadataRoute } from "next";
import { fetchSitemapData } from "@/lib/directory/sitemap-data";

const SITE_ORIGIN = "https://nowebsitebusinessleads.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let data: Awaited<ReturnType<typeof fetchSitemapData>> | null = null;

  try {
    data = await fetchSitemapData();
  } catch {
    data = null;
  }

  if (!data) {
    return [
      {
        url: `${SITE_ORIGIN}/`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
    ];
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_ORIGIN}/`,
      lastModified: data.homepageLastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...data.cityHubs.map((hub) => ({
      url: `${SITE_ORIGIN}/${hub.citySlug}`,
      lastModified: hub.lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...data.cityCategories.map((group) => ({
      url: `${SITE_ORIGIN}/${group.citySlug}/${group.categorySlug}`,
      lastModified: group.lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  return entries;
}
