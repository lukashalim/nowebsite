-- Enrichment-only flow (Omkar API key in BOTASAURUS_API_KEY):
--   1. npm run enrich-dispatch   — queues Botasaurus tasks (enrichment_jobs)
--   2. npm run enrich-poller     — until tasks complete (or use main poller pattern)
--   3. npm run enrich-pipeline   — writes businesses.contact_enrichment + enriched_at
--
-- enrich-dispatch defaults to pipeline sweet-spot: SWEET_SPOT_MIN_RATING / MIN_REVIEWS / MAX_REVIEWS.
-- Bypass with ENRICH_IGNORE_SWEET_SPOT=1.
-- Optional filters (env): ENRICH_FILTER_STATE, ENRICH_FILTER_BUSINESS_TYPE, ENRICH_FORCE=1
-- Row limit: ENRICH_TOTAL_LIMIT or node enrich-dispatch.mjs --limit=500

select count(*) filter (where enriched_at is null) as businesses_never_enriched
from public.businesses;

select count(*) from public.enrichment_jobs where status = 'pending';
select count(*) from public.enrichment_jobs where status = 'completed' and loaded_at is null;
