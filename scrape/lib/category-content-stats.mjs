/**
 * Maps --business-type ingest arg → category_content slug and additive sample stats.
 * Keep slug resolution aligned with src/lib/directory/category-merge.ts + slugs.ts.
 */

import {
  CATEGORY_MERGE_GROUPS,
  canonicalizeBusinessTypeToken,
} from "./category-merge.mjs";
import { mapSearchKeywordToBusinessType } from "./maps-search-category.mjs";

const LOCAL_CACHE_PLACEHOLDER = "local_cache";

/**
 * @param {string|null|undefined} businessTypeArg
 * @returns {string|null}
 */
export function businessTypeArgToCategorySlug(businessTypeArg) {
  const raw = businessTypeArg?.trim();
  if (!raw || raw === LOCAL_CACHE_PLACEHOLDER) return null;

  const canonical =
    mapSearchKeywordToBusinessType(raw) ?? canonicalizeBusinessTypeToken(raw);
  if (!canonical) return null;

  const token = String(canonical).trim();
  const group = CATEGORY_MERGE_GROUPS.find(
    (g) => g.canonicalBusinessType === token,
  );
  if (group) return group.primarySlug;

  return token.replace(/_/g, "-");
}

/**
 * @param {string|null|undefined} businessTypeArg
 * @returns {string}
 */
export function humanizeDisplayName(businessTypeArg) {
  const raw = businessTypeArg?.trim();
  if (!raw || raw === LOCAL_CACHE_PLACEHOLDER) return "Business";
  return raw;
}

/**
 * @param {number} inCategory
 * @param {number} withoutWebsite
 * @returns {number|null}
 */
export function computeWebsiteAdoptionPct(inCategory, withoutWebsite) {
  if (inCategory <= 0) return null;
  const withWebsite = Math.max(0, inCategory - withoutWebsite);
  const pct = Math.round((100 * withWebsite) / inCategory);
  return Math.min(100, Math.max(0, pct));
}

/**
 * Additively merge run sample counts into category_content.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ slug: string, displayName: string, runInCategory: number, runWithoutWebsite: number }} p
 * @returns {Promise<{ merged: { business_in_category: number, business_without_website: number, website_adoption_pct: number | null } } | { skipped: true, reason: string }>}
 */
export async function mergeCategoryContentStats(supabase, p) {
  const { slug, displayName, runInCategory, runWithoutWebsite } = p;

  if (runInCategory <= 0) {
    return { skipped: true, reason: "runInCategory is 0" };
  }

  const { data: existing, error: selErr } = await supabase
    .from("category_content")
    .select("business_in_category, business_without_website, display_name")
    .eq("slug", slug)
    .maybeSingle();

  if (selErr) {
    throw new Error(`category_content select (${slug}): ${selErr.message}`);
  }

  const prevIn = existing?.business_in_category ?? 0;
  const prevWithout = existing?.business_without_website ?? 0;
  const business_in_category = prevIn + runInCategory;
  const business_without_website = prevWithout + runWithoutWebsite;
  const website_adoption_pct = computeWebsiteAdoptionPct(
    business_in_category,
    business_without_website,
  );

  const row = {
    slug,
    display_name: existing?.display_name?.trim() || displayName,
    business_in_category,
    business_without_website,
    website_adoption_pct,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabase
    .from("category_content")
    .upsert(row, { onConflict: "slug" });

  if (upErr) {
    throw new Error(`category_content upsert (${slug}): ${upErr.message}`);
  }

  return {
    merged: {
      business_in_category,
      business_without_website,
      website_adoption_pct,
    },
  };
}

/**
 * @returns {boolean}
 */
export function isCategoryStatsDisabled() {
  return process.env.EXTRACT_LOCAL_DISABLE_CATEGORY_STATS === "1";
}
