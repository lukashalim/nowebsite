import {
  UK_REGION_SLUG_TO_NAME,
} from "@/lib/directory/country";

export function gbRegionFilterOr(regionSlug: string): string | null {
  const slug = regionSlug.trim().toLowerCase();
  const regionName = UK_REGION_SLUG_TO_NAME[slug];
  if (!regionName) return null;

  return `region_code.eq.${slug},state.eq.${regionName},state.ilike.${regionName}`;
}
