import { canonicalCategorySlug } from "@/lib/directory/category-merge";

/** Display order for nationwide category links (not sorted by listing count). */
export const CATEGORY_PRIORITY = [
  "chiropractor",
  "dentist",
  "plumber",
  "roofer",
  "hvac-contractor",
  "contractor",
  "electrician",
  "painter",
  "landscaper",
  "tree-service",
  "restaurant",
  "bar",
  "event-services",
  "tax-preparation-service",
  "pet-groomer",
  "pet-store",
  "massage-therapist",
  "massage-spa",
  "spa",
  "grocery-store",
  "convenience-store",
  "nail-salon",
  "laundromat",
  "laundry-service",
  "laundry",
  "dry-cleaner",
  "hair-salon",
  "barber-shop",
  "shopping-mall",
] as const;

const UNLISTED_PRIORITY = CATEGORY_PRIORITY.length;

const priorityIndexBySlug = new Map<string, number>(
  CATEGORY_PRIORITY.map((slug, index) => [slug, index]),
);

/** Lower index = earlier in UI. Unlisted categories sort after, by count descending. */
export function categoryPriorityIndex(categorySlug: string): number {
  const lower = categorySlug.trim().toLowerCase();
  const direct = priorityIndexBySlug.get(lower);
  if (direct !== undefined) return direct;
  const canonical = canonicalCategorySlug(lower);
  return priorityIndexBySlug.get(canonical) ?? UNLISTED_PRIORITY;
}

export interface CategorySortable {
  categorySlug: string;
  totalCount?: number;
  listingCount?: number;
  count?: number;
}

function categoryCount(item: CategorySortable): number {
  return item.totalCount ?? item.listingCount ?? item.count ?? 0;
}

export function compareCategoriesByPriority(
  a: CategorySortable,
  b: CategorySortable,
): number {
  const ai = categoryPriorityIndex(a.categorySlug);
  const bi = categoryPriorityIndex(b.categorySlug);
  if (ai !== bi) return ai - bi;
  return categoryCount(b) - categoryCount(a);
}

export function sortCategoriesByPriority<T extends CategorySortable>(
  items: T[],
): T[] {
  return [...items].sort(compareCategoriesByPriority);
}
