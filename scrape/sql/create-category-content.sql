-- Editorial copy for nationwide category hub pages (/[category-slug]).
-- slug must match the public directory category slug (e.g. barber-shop, dentist).

create table if not exists public.category_content (
  slug text primary key,
  display_name text not null,
  website_adoption_pct integer,
  business_in_category integer not null default 0,
  business_without_website integer not null default 0,
  pitch text,
  outreach_angle text,
  display_order integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.category_content is
  'Optional H1, pitch, and outreach copy for nationwide category directory pages.';
comment on column public.category_content.slug is
  'Directory URL slug; use canonical slug after category merges (e.g. barber-shop).';
comment on column public.category_content.website_adoption_pct is
  'Percent of businesses in this category that have their own website (not in this directory).';
comment on column public.category_content.business_in_category is
  'Maps extractor sample size for this category (additive across ingest runs).';
comment on column public.category_content.business_without_website is
  'Subset of business_in_category without their own website (additive across runs).';
