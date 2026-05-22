import {
  categoryLabelToSlug,
  stateAbbrToDisplayName,
  stateToAbbr,
} from "@/lib/directory/slugs";

export function formatCityState(city: string, state: string): string {
  const abbr = stateToAbbr(state);
  if (abbr) {
    return `${city.trim()}, ${abbr.toUpperCase()}`;
  }
  return `${city.trim()}, ${state.trim()}`;
}

export function pluralCategoryForTitle(label: string): string {
  const t = label.trim();
  if (!t) return "Businesses";
  const lower = t.toLowerCase();
  if (lower.endsWith("s")) return t;
  if (lower.endsWith("y") && !/[aeiou]y$/i.test(lower)) {
    return `${t.slice(0, -1)}ies`;
  }
  if (/(ch|sh|x|z|s)$/i.test(lower)) return `${t}es`;
  return `${t}s`;
}

export function categoryPageTitle(city: string, state: string, categoryLabel: string): string {
  const place = formatCityState(city, state);
  const plural = pluralCategoryForTitle(categoryLabel);
  return `${plural} in ${place} Without a Website`;
}

export function categoryMetaDescription(
  city: string,
  state: string,
  categoryLabel: string,
  count: number,
): string {
  const place = formatCityState(city, state);
  const plural = pluralCategoryForTitle(categoryLabel).toLowerCase();
  return `Browse ${count} ${plural} in ${place} with no website — phone numbers, ratings, and Google Maps links for web designers and agencies.`;
}

export function cityHubTitle(city: string, state: string): string {
  return `Businesses Without a Website in ${formatCityState(city, state)}`;
}

export function cityHubMetaDescription(city: string, state: string, categoryCount: number): string {
  const place = formatCityState(city, state);
  return `Directory of local businesses in ${place} that do not have a website. Explore ${categoryCount} categories with verified listings for designers and agencies.`;
}

export function categoryLinkLabel(categoryLabel: string): string {
  return pluralCategoryForTitle(categoryLabel);
}

export function categoryPath(citySlug: string, categoryLabel: string): string {
  return `/${citySlug}/${categoryLabelToSlug(categoryLabel)}`;
}

export function cityPath(citySlug: string): string {
  return `/${citySlug}`;
}

export function formatNeighborhoodOrArea(
  address: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const raw = address?.trim();
  if (!raw) return null;
  const cityLower = city?.trim().toLowerCase();
  const firstLine = raw.split(",")[0]?.trim();
  if (!firstLine) return null;
  if (cityLower && firstLine.toLowerCase() === cityLower) return null;
  return firstLine;
}
