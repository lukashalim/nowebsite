-- Sample-size counters for website adoption (updated by NDJSON ingest).

alter table public.category_content
  add column if not exists business_in_category integer not null default 0,
  add column if not exists business_without_website integer not null default 0;

comment on column public.category_content.business_in_category is
  'Maps extractor sample size for this category (additive across ingest runs).';
comment on column public.category_content.business_without_website is
  'Subset of business_in_category without their own website (additive across runs).';
