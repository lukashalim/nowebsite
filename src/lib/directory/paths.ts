import { COUNTRY_GB, COUNTRY_US } from "@/lib/directory/country";
import type { DirectoryCountry } from "@/lib/directory/types";

/** Public URL segment for United Kingdom hub. */
export const GB_COUNTRY_SLUG = "united-kingdom";

const COUNTRY_SLUG_TO_CODE: Record<string, DirectoryCountry> = {
  [GB_COUNTRY_SLUG]: COUNTRY_GB,
};

export function countrySlugToCode(slug: string): DirectoryCountry | null {
  return COUNTRY_SLUG_TO_CODE[slug.trim().toLowerCase()] ?? null;
}

export function countryCodeToSlug(country: DirectoryCountry): string | null {
  if (country === COUNTRY_GB) return GB_COUNTRY_SLUG;
  return null;
}

export function gbCountryPath(): string {
  return `/${GB_COUNTRY_SLUG}`;
}

export function gbRegionPath(regionSlug: string): string {
  return `/${GB_COUNTRY_SLUG}/${regionSlug.trim().toLowerCase()}`;
}

/** City hub under country only (no region segment in URL). */
export function gbCityPath(citySlug: string): string {
  return `/${GB_COUNTRY_SLUG}/${citySlug.trim().toLowerCase()}`;
}

