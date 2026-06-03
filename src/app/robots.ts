import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getSiteOrigin } from "@/lib/site-url";

const PRODUCTION_DISALLOWS = [
  "/_next/",
  "/api/",
  "/admin/",
  "/demo/",
  "/crm/",
  "/extract-progress/",
  "/scrape-progress/",
] as const;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  const isRingReady = host.includes("ringreadysite.com");

  if (isRingReady) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const origin = getSiteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRODUCTION_DISALLOWS],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
