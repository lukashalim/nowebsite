import { cache } from "react";
import { canonicalCategorySlug } from "@/lib/directory/category-merge";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface CategoryContent {
  slug: string;
  displayName: string;
  websiteAdoptionPct: number | null;
  pitch: string | null;
  outreachAngle: string | null;
}

interface CategoryContentRow {
  slug: string;
  display_name: string;
  website_adoption_pct: number | null;
  pitch: string | null;
  outreach_angle: string | null;
}

function rowToCategoryContent(row: CategoryContentRow): CategoryContent {
  return {
    slug: row.slug,
    displayName: row.display_name,
    websiteAdoptionPct: row.website_adoption_pct,
    pitch: row.pitch,
    outreachAngle: row.outreach_angle,
  };
}

export const fetchCategoryContent = cache(
  async (categorySlug: string): Promise<CategoryContent | null> => {
    const slug = canonicalCategorySlug(categorySlug.trim().toLowerCase());
    if (!slug) return null;

    try {
      const supabase = createSupabaseAdmin();
      const { data, error } = await supabase
        .from("category_content")
        .select(
          "slug, display_name, website_adoption_pct, pitch, outreach_angle",
        )
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        console.error("[fetchCategoryContent]", error.message);
        return null;
      }
      if (!data) return null;

      return rowToCategoryContent(data as CategoryContentRow);
    } catch (err) {
      console.error("[fetchCategoryContent]", err);
      return null;
    }
  },
);

/** First ~155 characters for meta description. */
export function categoryContentMetaDescription(pitch: string): string {
  const t = pitch.trim().replace(/\s+/g, " ");
  if (t.length <= 155) return t;
  const cut = t.slice(0, 152);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

const CATEGORY_PITCH_FALLBACKS: Record<string, string> = {
  restaurant:
    "Nationwide restaurants without a website — export-ready B2B lead lists for web designers. Find restaurants without a website near you in Houston, Chicago, Los Angeles, and other major markets. Sorted by review volume with reveal-gated contact fields for cold outreach.",
};

/** Static pitch when no category_content row exists (or pitch is empty). */
export function categoryPitchFallback(categorySlug: string): string | null {
  const slug = canonicalCategorySlug(categorySlug.trim().toLowerCase());
  return CATEGORY_PITCH_FALLBACKS[slug] ?? null;
}

/** Pitch for meta and on-page copy: DB content first, then static fallback. */
export function resolveCategoryPitch(
  categorySlug: string,
  content: CategoryContent | null | undefined,
): string | null {
  const fromDb = content?.pitch?.trim();
  if (fromDb) return fromDb;
  return categoryPitchFallback(categorySlug);
}
