import { siteOrganizationId, SITE_AUDIENCE_TYPE } from "@/lib/site-jsonld";
import { absoluteUrl, getSiteOrigin } from "@/lib/site-url";

export interface ProspectingDatasetJsonLdInput {
  name: string;
  description: string;
  path: string;
  recordCount: number;
  keywords?: string[];
  spatialCoverage?: string;
}

/**
 * Dataset JSON-LD for B2B prospecting hub pages.
 *
 * Omits per-row LocalBusiness items — those signal consumer lookup intent.
 * References the site Organization by @id (defined in root layout).
 */
export function buildProspectingDatasetJsonLd(
  input: ProspectingDatasetJsonLdInput,
): Record<string, unknown> {
  const pageUrl = absoluteUrl(input.path);
  const origin = getSiteOrigin();
  const keywords = [
    "businesses without website",
    "businesses without a website",
    "businesses without website near me",
    "B2B lead list",
    "no-website businesses",
    "agency prospecting",
    "web design leads",
    ...(input.keywords ?? []),
  ];

  const dataset: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${pageUrl}#dataset`,
    name: input.name,
    description: input.description,
    url: pageUrl,
    creator: { "@id": siteOrganizationId(origin) },
    publisher: { "@id": siteOrganizationId(origin) },
    audience: {
      "@type": "Audience",
      audienceType: SITE_AUDIENCE_TYPE,
    },
    keywords: keywords.join(", "),
    variableMeasured: [
      {
        "@type": "PropertyValue",
        name: "recordCount",
        value: input.recordCount,
      },
    ],
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "text/csv",
      contentUrl: absoluteUrl("/sign-in"),
      description: "Export-ready CSV for agency outreach (sign-in required)",
    },
  };

  if (input.spatialCoverage) {
    dataset.spatialCoverage = {
      "@type": "Place",
      name: input.spatialCoverage,
    };
  }

  return dataset;
}
