import { canonicalCategorySlug } from "@/lib/directory/category-merge";
import { resolveCategoryForRow } from "@/lib/directory/slugs";

/** Resolve canonical directory_category_slug for a listing row (US + GB). */
export function directoryCategorySlugForRow(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): string | null {
  const resolved = resolveCategoryForRow(mainCategory, businessType);
  if (!resolved) return null;
  return canonicalCategorySlug(resolved.slug);
}
