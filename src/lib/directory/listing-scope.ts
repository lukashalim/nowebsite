import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";

export type ListingScopeKind =
  | "city"
  | "category"
  | "state"
  | "facebook"
  | "gb-city"
  | "gb-region";

export interface ListingScope {
  kind: ListingScopeKind;
  slug: string;
}

export function serializeListingScope(scope: ListingScope): string {
  return `${scope.kind}:${scope.slug}`;
}

export function parseListingScope(raw: string): ListingScope | null {
  const trimmed = raw.trim().toLowerCase();
  const match = /^(city|category|state|facebook|gb-city|gb-region):(.+)$/.exec(
    trimmed,
  );
  if (!match) return null;
  const kind = match[1] as ListingScopeKind;
  const slug = match[2]!.trim();
  if (!slug) return null;
  if (kind === "facebook" && slug !== "all") return null;
  return { kind, slug };
}

export function hashListingFilters(filters: DirectoryListingFilters): string {
  return [
    filters.stateSlug ?? "",
    filters.citySlug ?? "",
    String(filters.minReviews),
  ].join("|");
}

export function listingScopeForCity(citySlug: string): ListingScope {
  return { kind: "city", slug: citySlug.toLowerCase() };
}

export function listingScopeForCategory(categorySlug: string): ListingScope {
  return { kind: "category", slug: categorySlug.toLowerCase() };
}

export function listingScopeForState(stateSlug: string): ListingScope {
  return { kind: "state", slug: stateSlug.toLowerCase() };
}

export function listingScopeForFacebook(): ListingScope {
  return { kind: "facebook", slug: "all" };
}

export function listingScopeForGbCity(citySlug: string): ListingScope {
  return { kind: "gb-city", slug: citySlug.toLowerCase() };
}

export function listingScopeForGbRegion(regionSlug: string): ListingScope {
  return { kind: "gb-region", slug: regionSlug.toLowerCase() };
}
