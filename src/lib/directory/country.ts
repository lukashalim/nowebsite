import type { DirectoryCountry } from "@/lib/directory/types";

export const COUNTRY_US: DirectoryCountry = "US";
export const COUNTRY_GB: DirectoryCountry = "GB";
export const COUNTRY_AU: DirectoryCountry = "AU";

export const UK_REGION_SLUG_TO_NAME: Record<string, string> = {
  england: "England",
  scotland: "Scotland",
  wales: "Wales",
  "northern-ireland": "Northern Ireland",
};

const UK_REGION_NAME_TO_SLUG: Record<string, string> = {
  england: "england",
  scotland: "scotland",
  wales: "wales",
  "northern ireland": "northern-ireland",
};

export function parseDirectoryCountry(
  raw: string | null | undefined,
): DirectoryCountry {
  const s = raw?.trim().toUpperCase();
  if (s === "GB" || s === "UK") return COUNTRY_GB;
  if (s === "AU" || s === "AUS" || s === "AUSTRALIA") return COUNTRY_AU;
  return COUNTRY_US;
}

export function parseUkRegionSlug(
  slug: string,
): { regionSlug: string; regionName: string } | null {
  const key = slug.trim().toLowerCase();
  const regionName = UK_REGION_SLUG_TO_NAME[key];
  if (!regionName) return null;
  return { regionSlug: key, regionName };
}

export function ukRegionNameToSlug(region: string): string | null {
  return UK_REGION_NAME_TO_SLUG[region.trim().toLowerCase()] ?? null;
}

export function ukRegionMatchesState(
  regionName: string,
  state: string | null | undefined,
): boolean {
  if (!state?.trim()) return false;
  return state.trim().toLowerCase() === regionName.trim().toLowerCase();
}
