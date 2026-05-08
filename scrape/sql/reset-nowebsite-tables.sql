-- Wipe demo/CRM slice only (does NOT touch public.businesses warehouse).
-- Resets identity sequences on both tables.
--
-- CRM + /demo only list rows with extracted review excerpts. After a reset, either:
--
--   A) Full scrape (recommended — one clean pass with all payload fields):
--      npm run demo:dispatch -- --business_type="your vertical"
--      npm run demo:poller -- --watch
--      npm run demo:pipeline
--      (demo:* / nowebsite scripts set ENABLE_REVIEWS_EXTRACTION=1 so highlights populate.)
--
--   B) Copy cohort from public.businesses, then re-scrape for highlights:
--      npm run demo:sync -- --limit N
--      npm run demo:backfill-seo -- --limit 200
--      npm run demo:poller && npm run demo:pipeline

truncate table public.scrape_jobs_nowebsite restart identity;
truncate table public.businesses_nowebsite restart identity;
