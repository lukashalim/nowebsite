-- High-level industry groups and canonical subcategory slug membership.
-- Run in Supabase SQL editor after deploy.
--
-- category_groups = industries (Home Services, Food & Hospitality, …)
-- category_group_members = directory subcategory slugs (plumber, restaurant, …)

create table if not exists public.category_groups (
  id text primary key,
  label text not null,
  description text not null default '',
  display_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.category_groups is
  'High-level industry buckets for directory UI and CRM Industry filter.';

create table if not exists public.category_group_members (
  category_slug text primary key,
  group_id text not null references public.category_groups (id) on update cascade on delete restrict,
  created_at timestamptz default now()
);

create index if not exists category_group_members_group_id_idx
  on public.category_group_members (group_id);

comment on table public.category_group_members is
  'Maps canonical directory_category_slug values to a category_groups row.';
comment on column public.category_group_members.category_slug is
  'Canonical URL slug after category merges (e.g. plumber, hair-salon).';

-- Seed groups (idempotent)
insert into public.category_groups (id, label, description, display_order)
values
  (
    'home-services',
    'Home Services',
    'Any business where a service provider comes to the customer''s home or property — plumbing, roofing, power washing, mobile car detailing, carpet cleaning, appliance repair, concrete work, chimney cleaning, and similar on-site trades.',
    1
  ),
  (
    'food-hospitality',
    'Food & Hospitality',
    'Restaurants, bars, and food retail.',
    2
  ),
  (
    'professional',
    'Professional',
    'Accountants, real estate, tax preparation, and similar office services.',
    3
  ),
  (
    'health-wellness',
    'Health & Wellness',
    'Personal care, medical-adjacent, and body wellness services.',
    4
  ),
  (
    'other',
    'Other',
    'Businesses where the customer visits the location, or trades that do not fit the groups above.',
    5
  )
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order,
  updated_at = now();

-- Seed subcategory slugs (idempotent)
insert into public.category_group_members (category_slug, group_id)
values
  ('plumber', 'home-services'),
  ('roofer', 'home-services'),
  ('hvac-contractor', 'home-services'),
  ('contractor', 'home-services'),
  ('electrician', 'home-services'),
  ('painter', 'home-services'),
  ('landscaper', 'home-services'),
  ('tree-service', 'home-services'),
  ('handyman', 'home-services'),
  ('mobile-mechanic', 'home-services'),
  ('mobile-auto-repair', 'home-services'),
  ('restaurant', 'food-hospitality'),
  ('bar', 'food-hospitality'),
  ('grocery-store', 'food-hospitality'),
  ('convenience-store', 'food-hospitality'),
  ('tax-preparation-service', 'professional'),
  ('accountant', 'professional'),
  ('real-estate-agent', 'professional'),
  ('real-estate-agency', 'professional'),
  ('chiropractor', 'health-wellness'),
  ('dentist', 'health-wellness'),
  ('massage-spa', 'health-wellness'),
  ('spa', 'health-wellness'),
  ('nail-salon', 'health-wellness'),
  ('hair-salon', 'health-wellness'),
  ('barber-shop', 'health-wellness'),
  ('auto-repair', 'other'),
  ('laundromat', 'other'),
  ('dry-cleaner', 'other'),
  ('event-services', 'other'),
  ('pet-groomer', 'other'),
  ('pet-store', 'other'),
  ('shopping-mall', 'other')
on conflict (category_slug) do update set
  group_id = excluded.group_id;
