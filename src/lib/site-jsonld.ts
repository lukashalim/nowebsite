import { getSiteOrigin } from "@/lib/site-url";

export const SITE_ORGANIZATION_NAME = "No Website Business Leads";

export const SITE_AUDIENCE_TYPE =
  "Web design agencies, freelancers, and digital marketers";

export function siteOrganizationId(origin = getSiteOrigin()): string {
  return `${origin}/#organization`;
}

export function siteWebSiteId(origin = getSiteOrigin()): string {
  return `${origin}/#website`;
}

export function buildSiteOrganizationJsonLd(
  origin = getSiteOrigin(),
): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": siteOrganizationId(origin),
    name: SITE_ORGANIZATION_NAME,
    url: origin,
    description:
      "B2B prospecting platform and export-ready lead lists for web designers and agencies targeting businesses without a website — including restaurants without a website nationwide.",
    audience: {
      "@type": "Audience",
      audienceType: SITE_AUDIENCE_TYPE,
    },
  };
}

export function buildSiteWebSiteJsonLd(
  origin = getSiteOrigin(),
): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": siteWebSiteId(origin),
    name: SITE_ORGANIZATION_NAME,
    url: origin,
    description:
      "B2B lead lists and prospecting CRM for web designers finding businesses without a website — including restaurants without a website and salons without a website.",
    publisher: { "@id": siteOrganizationId(origin) },
    audience: {
      "@type": "Audience",
      audienceType: SITE_AUDIENCE_TYPE,
    },
  };
}

export function buildSiteGraphJsonLd(
  origin = getSiteOrigin(),
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildSiteOrganizationJsonLd(origin),
      buildSiteWebSiteJsonLd(origin),
    ],
  };
}
