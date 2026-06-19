import { buildSiteGraphJsonLd } from "@/lib/site-jsonld";

export function SiteJsonLdScript() {
  const jsonLd = buildSiteGraphJsonLd();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
