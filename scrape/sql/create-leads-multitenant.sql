-- Multi-tenant demo sites: tenant profiles + per-user leads for /{username}/{slug}.

alter table public.profiles
  add column if not exists username text,
  add column if not exists user_payment_link text;

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

comment on column public.profiles.username is
  'URL-safe tenant handle for public demo paths: /{username}/{slug}';
comment on column public.profiles.user_payment_link is
  'Stripe Buy Button or Payment Link URL shown on tenant demo pages';

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  place_id text not null,
  name text,
  address text,
  city text,
  state text,
  postal_code text,
  business_type text,
  main_category text,
  rating numeric,
  reviews integer,
  phone text,
  google_maps_link text,
  facebook_url text,
  contact_enrichment jsonb,
  latitude double precision,
  longitude double precision,
  is_spending_on_ads boolean,
  competitive_weakness text,
  review_highlights jsonb,
  services_offered jsonb,
  hours jsonb,
  open_now boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_user_slug_unique unique (user_id, slug)
);

create index if not exists idx_leads_user_id on public.leads (user_id);
create index if not exists idx_leads_slug on public.leads (lower(slug));

alter table public.leads enable row level security;

comment on table public.leads is
  'Tenant-owned demo lead rows for multi-tenant preview sites at /{username}/{slug}';
