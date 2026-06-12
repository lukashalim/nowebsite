import "server-only";

import { cache } from "react";
import { canonicalCategorySlug } from "@/lib/directory/category-merge";
import {
  buildTaxonomyFromGroups,
  FALLBACK_CATEGORY_GROUPS,
  isCategoryGroupId,
  type CategoryGroup,
  type CategoryGroupId,
  type CategoryGroupTaxonomy,
} from "@/lib/directory/category-group-ids";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export {
  allNamedCategoryGroupSlugs,
  buildTaxonomyFromGroups,
  categoryGroupById,
  categoryGroupForSlug,
  categorySlugsForGroup,
  CATEGORY_GROUP_IDS,
  CATEGORY_GROUPS,
  FALLBACK_CATEGORY_GROUPS,
  fallbackCategoryGroupTaxonomy,
  groupPublishedCategories,
  type CategoryGroup,
  type CategoryGroupId,
  type CategoryGroupTaxonomy,
  type GroupedCategories,
} from "@/lib/directory/category-group-ids";

interface CategoryGroupRow {
  id: string;
  label: string;
  description: string;
  display_order: number;
}

interface CategoryGroupMemberRow {
  category_slug: string;
  group_id: string;
}

function buildTaxonomyFromDbRows(
  groupRows: CategoryGroupRow[],
  memberRows: CategoryGroupMemberRow[],
): CategoryGroupTaxonomy | null {
  if (groupRows.length === 0) return null;

  const membersByGroup = new Map<string, string[]>();
  for (const row of memberRows) {
    const slug = canonicalCategorySlug(row.category_slug.trim().toLowerCase());
    const groupId = row.group_id.trim().toLowerCase();
    if (!slug || !isCategoryGroupId(groupId)) continue;
    const list = membersByGroup.get(groupId) ?? [];
    list.push(slug);
    membersByGroup.set(groupId, list);
  }

  const groups: CategoryGroup[] = groupRows
    .filter((row) => isCategoryGroupId(row.id))
    .sort((a, b) => a.display_order - b.display_order)
    .map((row) => ({
      id: row.id as CategoryGroupId,
      label: row.label,
      description: row.description ?? "",
      slugs: [...(membersByGroup.get(row.id) ?? [])].sort(),
    }));

  if (groups.length === 0) return null;
  return buildTaxonomyFromGroups(groups);
}

export const fetchCategoryGroupTaxonomy = cache(
  async (): Promise<CategoryGroupTaxonomy> => {
    try {
      const supabase = createSupabaseAdmin();
      const [groupsRes, membersRes] = await Promise.all([
        supabase
          .from("category_groups")
          .select("id, label, description, display_order")
          .order("display_order", { ascending: true }),
        supabase
          .from("category_group_members")
          .select("category_slug, group_id"),
      ]);

      if (groupsRes.error) {
        console.error("[fetchCategoryGroupTaxonomy] groups:", groupsRes.error.message);
        return buildTaxonomyFromGroups(FALLBACK_CATEGORY_GROUPS);
      }
      if (membersRes.error) {
        console.error("[fetchCategoryGroupTaxonomy] members:", membersRes.error.message);
        return buildTaxonomyFromGroups(FALLBACK_CATEGORY_GROUPS);
      }

      const fromDb = buildTaxonomyFromDbRows(
        (groupsRes.data ?? []) as CategoryGroupRow[],
        (membersRes.data ?? []) as CategoryGroupMemberRow[],
      );
      return fromDb ?? buildTaxonomyFromGroups(FALLBACK_CATEGORY_GROUPS);
    } catch (err) {
      console.error("[fetchCategoryGroupTaxonomy]", err);
      return buildTaxonomyFromGroups(FALLBACK_CATEGORY_GROUPS);
    }
  },
);
