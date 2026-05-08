import type { MetadataRoute } from "next";
import { fetchAllDemoCohortPlaceIds } from "@/lib/crm-cohort";
import { getSiteOrigin } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const now = new Date();
  let ids: string[] = [];
  try {
    ids = await fetchAllDemoCohortPlaceIds();
  } catch {
    ids = [];
  }

  const demoUrls: MetadataRoute.Sitemap = ids.map((id) => ({
    url: `${origin}/demo/${encodeURIComponent(id)}`,
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
