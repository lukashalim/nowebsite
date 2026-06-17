import type { DirectoryBusiness } from "@/lib/directory/types";
import { absoluteUrl } from "@/lib/site-url";

/**
 * ItemList JSON-LD with per-row LocalBusiness items — used on state and category hubs.
 *
 * Do not add to city hub pages: LocalBusiness + telephone/openingHours signals
 * consumer lookup intent. If city pages need structured data later, use Dataset
 * with audience.audienceType (e.g. "Web design agencies") and omit per-business
 * LocalBusiness list items.
 */
export function buildDirectoryListJsonLd(
  businesses: DirectoryBusiness[],
  path: string,
  listName: string,
): Record<string, unknown> {
  const pageUrl = absoluteUrl(path);
  const items = businesses.map((b, index) => {
    const name = b.name?.trim() || "Local business";
    const item: Record<string, unknown> = {
      "@type": "LocalBusiness",
      name,
      position: index + 1,
    };
    if (b.rating != null && b.reviews != null && b.reviews > 0) {
      item.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: b.rating,
        reviewCount: b.reviews,
        bestRating: 5,
        worstRating: 1,
      };
    }
    const city = b.city?.trim();
    const region = b.state?.trim();
    if (city || region) {
      item.address = {
        "@type": "PostalAddress",
        ...(city ? { addressLocality: city } : {}),
        ...(region ? { addressRegion: region } : {}),
        addressCountry: b.country ?? "US",
      };
    }
    return item;
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: pageUrl,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item,
    })),
  };
}
