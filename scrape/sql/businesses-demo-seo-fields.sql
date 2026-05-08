-- Demo SEO fields for richer generated sites.
-- Replay-safe migration for Supabase.

alter table public.businesses
  add column if not exists review_highlights jsonb;

alter table public.businesses
  add column if not exists services_offered text[];

alter table public.businesses
  add column if not exists hours jsonb;

alter table public.businesses
  add column if not exists open_now boolean;

alter table public.businesses
  add column if not exists review_highlights_updated_at timestamptz;

-- Optional minimal indexes (keep cost low).
create index if not exists idx_businesses_open_now
  on public.businesses (open_now)
  where has_website = false;
