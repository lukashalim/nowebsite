import type { MetadataRoute } from "next";
import { fetchAllDemoCohortPublicDemoPaths } from "@/lib/crm-cohort";
import { getSiteOrigin } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const now = new Date();
  let paths: string[] = [];
  try {
    paths = await fetchAllDemoCohortPublicDemoPaths();
  } catch {
    paths = [];
  }

  const demoUrls: MetadataRoute.Sitemap = paths.map((path) => ({
    url: `${origin}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    {
      url: `${origin}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: `${origin}/demo`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...demoUrls,
  ];
}
