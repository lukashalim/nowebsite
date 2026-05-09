import type { DemoBusiness } from "@/lib/crm-cohort";
import { collectSameAsUrls } from "@/lib/demo-enrichment";
import { demoPublicPath } from "@/lib/demo-slug";
import { absoluteUrl } from "@/lib/site-url";

export function buildLocalBusinessJsonLd(
  b: DemoBusiness,
): Record<string, unknown> {
  const name = b.name?.trim() || "Local business";
  const service =
    b.business_type?.trim() || b.main_category?.trim() || "local services";
  const street = b.address?.trim();
  const city = b.city?.trim();
  const region = b.state?.trim();
  const postal = b.postal_code?.trim();
  const hasAddress = Boolean(street || city || region || postal);
  const areaLabel = [city, region].filter(Boolean).join(", ") || "your area";

  const salesBlurb = b.enrichment?.sales_summary?.trim();
  const description = salesBlurb
    ? salesBlurb.replace(/\s+/g, " ").slice(0, 500)
    : `${name} offers ${service} in ${areaLabel}.`;

  const sameAs = collectSameAsUrls(
    b.facebook_url,
    b.google_maps_link,
    b.enrichment ?? null,
  );

  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description,
    url: absoluteUrl(demoPublicPath(b)),
  };

  const areaServed = [city, region, postal].filter(Boolean);
  if (areaServed.length > 0) {
    obj.areaServed = {
      "@type": "AdministrativeArea",
      name: areaServed.join(", "),
    };
  }

  if (hasAddress) {
    obj.address = {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      ...(city ? { addressLocality: city } : {}),
      ...(region ? { addressRegion: region } : {}),
      ...(postal ? { postalCode: postal } : {}),
      addressCountry: "US",
    };
  }

  if (
    b.latitude != null &&
    b.longitude != null &&
    Number.isFinite(b.latitude) &&
    Number.isFinite(b.longitude)
  ) {
    obj.geo = {
      "@type": "GeoCoordinates",
      latitude: b.latitude,
      longitude: b.longitude,
    };
  }

  if (b.phone?.trim()) {
    obj.telephone = b.phone.trim();
  }

  if (b.rating != null && b.reviews != null && b.reviews > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: b.rating,
      reviewCount: b.reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (sameAs.length > 0) {
    obj.sameAs = sameAs;
  }

  if (Array.isArray(b.hours) && b.hours.length > 0) {
    const specs = b.hours
      .map((h) => {
        const day = String(h.day ?? "").trim().toLowerCase();
        const dayMap: Record<string, string> = {
          monday: "https://schema.org/Monday",
          tuesday: "https://schema.org/Tuesday",
          wednesday: "https://schema.org/Wednesday",
          thursday: "https://schema.org/Thursday",
          friday: "https://schema.org/Friday",
          saturday: "https://schema.org/Saturday",
          sunday: "https://schema.org/Sunday",
        };
        const dayRef = dayMap[day];
        if (!dayRef || !h.opens || !h.closes) return null;
        return {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: dayRef,
          opens: h.opens,
          closes: h.closes,
        };
      })
      .filter(Boolean);
    if (specs.length > 0) {
      obj.openingHoursSpecification = specs;
    }
  }

  return obj;
}
