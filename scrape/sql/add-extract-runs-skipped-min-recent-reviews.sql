-- Applied via Supabase MCP (project hihupmzzlgxotxwcknjh).

alter table public.extract_local_cache_runs
  add column if not exists skipped_min_recent_reviews integer not null default 0;

comment on column public.extract_local_cache_runs.skipped_min_recent_reviews is
  'Rows skipped: fewer than SCRAPE_MIN_RECENT_REVIEWS (default 4) with dates in SCRAPE_RECENT_REVIEWS_MONTHS (default 6).';
