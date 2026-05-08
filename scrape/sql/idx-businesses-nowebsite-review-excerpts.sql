-- Speeds CRM + /demo queries that require json review excerpts.
-- Safe to run if column review_highlights exists on businesses_nowebsite.

create index if not exists idx_businesses_nowebsite_review_excerpts
  on public.businesses_nowebsite (reviews desc, rating desc)
  where has_website = false
    and review_highlights is not null
    and (review_highlights->0->>'excerpt') is not null
    and btrim(review_highlights->0->>'excerpt') <> '';
