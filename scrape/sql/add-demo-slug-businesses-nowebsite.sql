-- Public demo URLs: /demo/{demo_slug} instead of raw Google place_id.
-- Run in Supabase SQL editor (replay-safe).

alter table public.businesses_nowebsite
  add column if not exists demo_slug text;

create unique index if not exists idx_businesses_nowebsite_demo_slug_unique
  on public.businesses_nowebsite (demo_slug)
  where demo_slug is not null;

comment on column public.businesses_nowebsite.demo_slug is
  'URL-safe slug for /demo/{slug}; lowercase a-z0-9; disambiguated with numeric suffix (foo2, foo3).';
