-- Persist Angi/HomeAdvisor listing detection + nearby Angi competitors for CRM.
-- Run in Supabase SQL editor before backfill or CRM filter goes live.

alter table public.businesses_nowebsite
  add column if not exists has_angi_listing boolean,
  add column if not exists angi_listing_url text,
  add column if not exists angi_listing_title text,
  add column if not exists angi_listing_confidence real,
  add column if not exists angi_competitors jsonb,
  add column if not exists angi_listing_checked_at timestamptz,
  add column if not exists angi_owner_name text;

comment on column public.businesses_nowebsite.angi_owner_name is
  'Owner first name extracted from Angi/HomeAdvisor profile About us during listing scrape.';

comment on column public.businesses_nowebsite.has_angi_listing is
  'True when SERP fuzzy-match found an Angi/HomeAdvisor listing; null = not checked.';
comment on column public.businesses_nowebsite.angi_competitors is
  'JSON array of {name, url?, title?} — up to 3 same-area Angi competitors from SERP.';

create index if not exists idx_businesses_nowebsite_has_angi_listing
  on public.businesses_nowebsite (has_angi_listing)
  where has_angi_listing is not null;

-- Allow Angi-specific spintax templates (call/SMS/DM for Angi-listed leads).
alter table public.spintax_templates
  drop constraint if exists spintax_templates_audience_check;

alter table public.spintax_templates
  add constraint spintax_templates_audience_check
  check (audience in ('facebook', 'no_facebook', 'any', 'angi'));

comment on column public.spintax_templates.audience is
  'Lead type: facebook listing, no Facebook, any, or Angi-listed home-services leads.';
