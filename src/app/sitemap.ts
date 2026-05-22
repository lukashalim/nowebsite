import type { MetadataRoute } from "next";
import { fetchSitemapPaths } from "@/lib/directory/data";
import { getSiteOrigin } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const now = new Date();
  let paths: string[] = ["/", "/pro"];

  try {
    paths = await fetchSitemapPaths();
  } catch {
    // keep minimal fallback
  }

  return paths.map((path) => ({
    url: `${origin}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path === "/pro" ? 0.8 : 0.7,
  }));
}
