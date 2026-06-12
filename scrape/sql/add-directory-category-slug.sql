-- Canonical directory category slug for scoped listing queries and facets.
-- Backfill via: npx tsx scripts/backfill-directory-category-slug.ts

ALTER TABLE public.businesses_nowebsite
  ADD COLUMN IF NOT EXISTS directory_category_slug text;

CREATE INDEX IF NOT EXISTS idx_businesses_nowebsite_us_category_slug_reviews
  ON public.businesses_nowebsite (directory_category_slug, reviews DESC, place_id)
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND (country = 'US' OR country IS NULL)
    AND directory_category_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_nowebsite_gb_category_slug_reviews
  ON public.businesses_nowebsite (directory_category_slug, reviews DESC, place_id)
  WHERE has_website = false
    AND country = 'GB'
    AND directory_category_slug IS NOT NULL;
