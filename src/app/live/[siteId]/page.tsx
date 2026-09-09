import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ClientBusinessSite } from "@/components/client-business-site";
import { fetchDemoBusinessByUrlSegment } from "@/lib/crm-cohort";
import {
  getClientSiteByHost,
  getClientSiteById,
} from "@/lib/client-sites";

export const revalidate = 0;
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ siteId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { siteId } = await params;
  const site = getClientSiteById(siteId);
  if (!site) {
    return { title: "Site not found", robots: { index: false, follow: false } };
  }

  const host = (await headers()).get("host") ?? "";
  const hostSite = getClientSiteByHost(host);
  const canonical = hostSite?.origin ?? site.origin;

  return {
    title: { absolute: site.title },
    description: site.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: site.title,
      description: site.description,
      url: canonical,
      siteName: site.name,
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
  };
}

export default async function LiveClientSitePage({ params }: PageProps) {
  const { siteId } = await params;
  const site = getClientSiteById(siteId);
  if (!site) notFound();

  const business = await fetchDemoBusinessByUrlSegment(site.placeId);
  if (!business) notFound();

  return <ClientBusinessSite site={site} business={business} />;
}
