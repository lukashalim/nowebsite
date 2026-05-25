-- Add country for US vs UK directory routing. Run once in Supabase SQL editor.

alter table public.businesses_nowebsite
  add column if not exists country text not null default 'US';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_nowebsite_country_check'
  ) then
    alter table public.businesses_nowebsite
      add constraint businesses_nowebsite_country_check
      check (country in ('US', 'GB'));
  end if;
end $$;

comment on column public.businesses_nowebsite.country is
  'ISO-style market: US (default) or GB (United Kingdom).';

create index if not exists idx_businesses_nowebsite_country_has_website
  on public.businesses_nowebsite (country, has_website)
  where has_website = false;

create index if not exists idx_businesses_nowebsite_country_city_state
  on public.businesses_nowebsite (country, city, state)
  where has_website = false;

-- Backfill GB where postcode or nation indicates UK
update public.businesses_nowebsite
set country = 'GB'
where country = 'US'
  and (
    postal_code ~* '^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$'
    or lower(trim(coalesce(state, ''))) in (
      'england', 'scotland', 'wales', 'northern ireland',
      'uk', 'united kingdom', 'great britain'
    )
  );
