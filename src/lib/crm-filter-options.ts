import {
  categoryGroupForSlug,
  type CategoryGroupId,
  type CategoryGroupTaxonomy,
} from "@/lib/directory/category-group-ids";
import { resolveCategoryForRow } from "@/lib/directory/slugs";

export interface CrmCategoryFilterOption {
  value: string;
  label: string;
  groupId: CategoryGroupId;
}

export interface CrmStateFilterOption {
  value: string;
  label: string;
}

/** @deprecated Use CrmCategoryFilterOption */
export type CrmFilterOption = CrmCategoryFilterOption;

export interface CrmFilterOptions {
  categories: CrmCategoryFilterOption[];
  states: CrmStateFilterOption[];
}

export function mainCategoryGroupId(
  mainCategory: string,
  taxonomy: CategoryGroupTaxonomy,
): CategoryGroupId {
  const resolved = resolveCategoryForRow(mainCategory, null);
  if (!resolved) return "other";
  return categoryGroupForSlug(resolved.slug, taxonomy);
}

export function filterCrmCategoriesByGroup(
  categories: CrmCategoryFilterOption[],
  categoryGroup: CategoryGroupId | undefined,
): CrmCategoryFilterOption[] {
  if (!categoryGroup) return categories;
  return categories.filter((c) => c.groupId === categoryGroup);
}

export function categoryAllowedForGroup(
  category: string,
  categoryGroup: CategoryGroupId | undefined,
  categories: CrmCategoryFilterOption[],
): boolean {
  if (!category) return true;
  if (!categoryGroup) return categories.some((c) => c.value === category);
  return categories.some(
    (c) => c.value === category && c.groupId === categoryGroup,
  );
}
