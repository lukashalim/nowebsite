import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getClientSiteByHost } from "@/lib/client-sites";
import {
  isRingReadyHost,
  RING_READY_INDEXABLE_PATHS,
} from "@/lib/ringready-site";
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
  const clientSite = getClientSiteByHost(host);
  if (clientSite) {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/live/", "/api/", "/admin/"],
      },
      sitemap: `${clientSite.origin}/sitemap.xml`,
      host: new URL(clientSite.origin).host,
    };
  }

  const isRingReady = isRingReadyHost(host);

  if (isRingReady) {
    return {
      rules: {
        userAgent: "*",
        allow: [...RING_READY_INDEXABLE_PATHS],
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
