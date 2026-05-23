-- Freshness timestamp for directory "Last updated" (set on each Botasaurus/extract upsert).
alter table public.businesses_nowebsite
  add column if not exists last_scraped_at timestamptz;

create index if not exists idx_businesses_nowebsite_last_scraped_at
  on public.businesses_nowebsite (last_scraped_at desc nulls last)
  where has_website = false;
