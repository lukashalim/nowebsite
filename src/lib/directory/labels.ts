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

/** Turn DB/scraper values like `event_services` or `painter` into "Event Services", "Painter". */
export function formatCategoryDisplayName(raw: string): string {
  const t = raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!t) return "Business";
  return t
    .split(" ")
    .map((word) => {
      if (!word) return word;
      // Only force uppercase for 1–2 letter tokens (e.g. "IT"); keep words like "spa" → "Spa".
      if (word.length <= 2 && /^[a-z]+$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function pluralCategoryForTitle(label: string): string {
  const t = formatCategoryDisplayName(label);
  if (!t) return "Businesses";
  const lower = t.toLowerCase();
  if (lower.endsWith("s")) return t;
  if (lower.endsWith("y") && !/[aeiou]y$/i.test(lower)) {
    return `${t.slice(0, -1)}ies`;
  }
  if (/(ch|sh|x|z|s)$/i.test(lower)) return `${t}es`;
  return `${t}s`;
}

export function nationwideCategoryPageTitle(categoryLabel: string): string {
  const plural = pluralCategoryForTitle(categoryLabel);
  return `${plural} Without a Website`;
}

export function nationwideCategoryMetaDescription(
  categoryLabel: string,
  count: number,
): string {
  const plural = pluralCategoryForTitle(categoryLabel).toLowerCase();
  return `Browse ${count} ${plural} with no website — phone numbers, ratings, and Google Maps links for web designers and agencies.`;
}

export function cityHubTitle(city: string, state: string): string {
  return `Businesses Without a Website in ${formatCityState(city, state)}`;
}

export function cityHubMetaDescription(
  city: string,
  state: string,
  listingCount: number,
): string {
  const place = formatCityState(city, state);
  return `Directory of ${listingCount} local businesses in ${place} that do not have a website — phone numbers, ratings, and Google Maps links for designers and agencies.`;
}

export function categoryLinkLabel(categoryLabel: string): string {
  return pluralCategoryForTitle(formatCategoryDisplayName(categoryLabel));
}

/** Short singular-style label for grids (e.g. "Painter", "Event Services"). */
export function categoryGridLabel(categoryLabel: string): string {
  return formatCategoryDisplayName(categoryLabel);
}

export function categoryPath(categoryLabel: string): string {
  return `/${categoryLabelToSlug(categoryLabel)}`;
}

export function cityPath(citySlug: string): string {
  return `/${citySlug}`;
}

/** e.g. "May 2026" for directory freshness line. */
export function formatLastUpdatedMonthYear(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
