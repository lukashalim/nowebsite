-- Enable RLS on nowebsite pipeline tables (service_role bypasses RLS; anon/authenticated get no access until you add policies).
-- Applied via Supabase MCP migration enable_rls_nowebsite_pipeline_tables.
-- Next.js + scrape scripts in this repo use SUPABASE_SERVICE_ROLE_KEY only for these tables.

ALTER TABLE public.extract_local_cache_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_jobs_nowebsite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses_nowebsite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
