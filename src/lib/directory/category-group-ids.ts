import { canonicalCategorySlug } from "@/lib/directory/category-merge";
import {
  compareCategoriesByPriority,
  type CategorySortable,
} from "@/lib/directory/category-priority";

export const CATEGORY_GROUP_IDS = [
  "home-services-high-opportunity",
  "home-services",
  "food-hospitality",
  "professional",
  "health-wellness",
  "other",
] as const;

export type CategoryGroupId = (typeof CATEGORY_GROUP_IDS)[number];

export interface CategoryGroup {
  id: CategoryGroupId;
  label: string;
  description: string;
  slugs: readonly string[];
}

/** Static fallback when Supabase taxonomy is empty or unavailable. */
export const FALLBACK_CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    id: "home-services-high-opportunity",
    label: "Home Services — High opportunity",
    description:
      "Mail-first. Emergency, high-ticket, owner-operator trades.",
    slugs: [
      "air-conditioning-contractor",
      "air-conditioning-repair-service",
      "arborist-service",
      "bathroom-remodeler",
      "building-restoration-service",
      "chimney-services",
      "chimney-sweep",
      "concrete-contractor",
      "deck-builder",
      "electrical-installation-service",
      "electrician",
      "fence-contractor",
      "fire-damage-restoration-service",
      "furnace-repair-service",
      "gutter-service",
      "hvac-contractor",
      "insulation-contractor",
      "kitchen-remodeler",
      "masonry-contractor",
      "paving-contractor",
      "pest-control-service",
      "plumber",
      "remodeler",
      "roofer",
      "septic-system-service",
      "siding-contractor",
      "swimming-pool-contractor",
      "swimming-pool-repair-service",
      "tree-service",
      "water-damage-restoration-service",
      "waterproofing-service",
      "well-drilling-contractor",
      "window-installation-service",
    ],
  },
  {
    id: "home-services",
    label: "Home Services",
    description:
      "On-site home and property trades that are not in the high-opportunity mail-first bucket — cleaning, landscaping, painting, handyman, stores, and similar.",
    slugs: [
      "air-conditioning-store",
      "air-conditioning-system-supplier",
      "air-duct-cleaning-service",
      "appliance-repair-service",
      "building-firm",
      "carpenter",
      "carpet-cleaning-service",
      "cleaning-service",
      "construction-company",
      "contractor",
      "custom-home-builder",
      "debris-removal-service",
      "demolition-contractor",
      "dog-walker",
      "double-glazing-installer",
      "drainage-service",
      "dry-wall-contractor",
      "dryer-vent-cleaning-service",
      "dumpster-rental-service",
      "emergency-locksmith-service",
      "excavating-contractor",
      "floor-refinishing-service",
      "flooring-contractor",
      "garage-door-supplier",
      "garbage-collection-service",
      "gas-engineer",
      "general-contractor",
      "glass-repair-service",
      "gutter-cleaning-service",
      "handyman",
      "handyman-handywoman-handyperson",
      "heating-equipment-supplier",
      "home-builder",
      "home-cinema-installation",
      "home-help",
      "home-inspector",
      "house-cleaning-service",
      "house-clearance-service",
      "interior-designer",
      "janitorial-service",
      "joiner",
      "junk-removal-service",
      "landscape-architect",
      "landscape-designer",
      "landscaper",
      "lawn-equipment-rental-service",
      "locksmith",
      "mechanical-contractor",
      "metal-construction-company",
      "mobile-auto-repair",
      "mobile-mechanic",
      "mover",
      "moving-and-storage-service",
      "painter",
      "plasterer",
      "pool-cleaning-service",
      "pressure-washing-service",
      "professional-organizer",
      "property-maintenance",
      "refrigerator-repair-service",
      "repair-service",
      "rv-repair-and-maintenance-service",
      "scaffolding-rental-service",
      "snow-removal-service",
      "tile-contractor",
      "towing-service",
      "upholstery-cleaning-service",
      "wallpaper-installer",
      "washer-dryer-repair-service",
      "waste-management-service",
      "water-tank-cleaning-service",
      "welder",
      "window-cleaning-service",
      "wood-floor-installation-service",
      "wood-floor-refinishing-service",
      "woodworker",
    ],
  },
  {
    id: "food-hospitality",
    label: "Food & Hospitality",
    description: "Restaurants, bars, and food retail.",
    slugs: ["restaurant", "bar", "grocery-store", "convenience-store"],
  },
  {
    id: "professional",
    label: "Professional",
    description:
      "Accountants, real estate, tax preparation, and similar office services.",
    slugs: [
      "tax-preparation-service",
      "accountant",
      "real-estate-agent",
      "real-estate-agency",
    ],
  },
  {
    id: "health-wellness",
    label: "Health & Wellness",
    description: "Personal care, medical-adjacent, and body wellness services.",
    slugs: [
      "chiropractor",
      "dentist",
      "massage-spa",
      "spa",
      "nail-salon",
      "hair-salon",
      "barber-shop",
    ],
  },
  {
    id: "other",
    label: "Other",
    description:
      "Businesses where the customer visits the location, or trades that do not fit the groups above.",
    slugs: [
      "auto-repair",
      "laundromat",
      "dry-cleaner",
      "event-services",
      "pet-groomer",
      "pet-store",
      "shopping-mall",
    ],
  },
] as const;

export interface CategoryGroupTaxonomy {
  groups: readonly CategoryGroup[];
  slugToGroupId: ReadonlyMap<string, CategoryGroupId>;
}

export function isCategoryGroupId(value: string): value is CategoryGroupId {
  return (CATEGORY_GROUP_IDS as readonly string[]).includes(value);
}

export function buildTaxonomyFromGroups(
  groups: readonly CategoryGroup[],
): CategoryGroupTaxonomy {
  const slugToGroupId = new Map<string, CategoryGroupId>();

  for (const group of groups) {
    if (group.id === "other") continue;
    for (const slug of group.slugs) {
      slugToGroupId.set(canonicalCategorySlug(slug), group.id);
    }
  }

  return { groups, slugToGroupId };
}

export function fallbackCategoryGroupTaxonomy(): CategoryGroupTaxonomy {
  return buildTaxonomyFromGroups(FALLBACK_CATEGORY_GROUPS);
}

export function categoryGroupForSlug(
  slug: string,
  taxonomy: CategoryGroupTaxonomy,
): CategoryGroupId {
  const canonical = canonicalCategorySlug(slug.trim().toLowerCase());
  return taxonomy.slugToGroupId.get(canonical) ?? "other";
}

export function categoryGroupById(
  id: CategoryGroupId,
  taxonomy: CategoryGroupTaxonomy,
): CategoryGroup {
  const group = taxonomy.groups.find((g) => g.id === id);
  if (!group) {
    throw new Error(`Unknown category group: ${id}`);
  }
  return group;
}

/** All canonical slugs in named groups (excludes implicit other fallback). */
export function allNamedCategoryGroupSlugs(
  taxonomy: CategoryGroupTaxonomy,
): string[] {
  return [...taxonomy.slugToGroupId.keys()];
}

/** Slugs to pass to `.in()` for CRM/directory filters (non-other groups only). */
export function categorySlugsForGroup(
  id: CategoryGroupId,
  taxonomy: CategoryGroupTaxonomy,
): string[] {
  if (id === "other") {
    return categoryGroupById("other", taxonomy).slugs.map((s) =>
      canonicalCategorySlug(s),
    );
  }
  const group = categoryGroupById(id, taxonomy);
  const slugs = new Set<string>();
  for (const slug of group.slugs) {
    slugs.add(canonicalCategorySlug(slug));
  }
  return [...slugs];
}

export interface GroupedCategories<T extends CategorySortable> {
  group: CategoryGroup;
  items: T[];
}

export function groupPublishedCategories<T extends CategorySortable>(
  items: T[],
  taxonomy: CategoryGroupTaxonomy,
): GroupedCategories<T>[] {
  const buckets = new Map<CategoryGroupId, T[]>();

  for (const item of items) {
    const groupId = categoryGroupForSlug(item.categorySlug, taxonomy);
    const list = buckets.get(groupId) ?? [];
    list.push(item);
    buckets.set(groupId, list);
  }

  const result: GroupedCategories<T>[] = [];
  for (const group of taxonomy.groups) {
    const bucket = buckets.get(group.id);
    if (!bucket?.length) continue;
    result.push({
      group,
      items: [...bucket].sort(compareCategoriesByPriority),
    });
  }
  return result;
}

/** @deprecated Import FALLBACK_CATEGORY_GROUPS or fetchCategoryGroupTaxonomy instead. */
export const CATEGORY_GROUPS = FALLBACK_CATEGORY_GROUPS;
