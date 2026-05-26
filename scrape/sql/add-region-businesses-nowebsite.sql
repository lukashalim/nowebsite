-- Human region + URL slug for multi-country directory paths.

alter table public.businesses_nowebsite
  add column if not exists region text,
  add column if not exists region_code text;

comment on column public.businesses_nowebsite.region is
  'Human-readable region: US state name, UK nation (England/Wales), province, etc.';
comment on column public.businesses_nowebsite.region_code is
  'URL slug for region segment, e.g. texas, england, wales.';

create index if not exists idx_businesses_nowebsite_country_region_city
  on public.businesses_nowebsite (country, region_code, city)
  where has_website = false;

-- GB: region mirrors nation in state until backfill script refines rows
update public.businesses_nowebsite
set
  region = trim(state),
  region_code = case lower(trim(state))
    when 'england' then 'england'
    when 'scotland' then 'scotland'
    when 'wales' then 'wales'
    when 'northern ireland' then 'northern-ireland'
    else null
  end
where country = 'GB'
  and state is not null
  and (region is null or region_code is null);

-- US: region mirrors state; region_code is URL-safe slug.
update public.businesses_nowebsite
set
  region = case when region is null or trim(region) = '' then state else region end,
  region_code = case
    when region_code is null or trim(region_code) = '' then
      trim(
        both '-' from regexp_replace(lower(coalesce(state, '')), '[^a-z0-9]+', '-', 'g')
      )
    else region_code
  end
where country = 'US'
  and has_website = false
  and state is not null
  and (
    region is null or trim(region) = ''
    or region_code is null or trim(region_code) = ''
  );

-- Welsh cities incorrectly stored as England
update public.businesses_nowebsite
set
  state = 'Wales',
  region = 'Wales',
  region_code = 'wales'
where country = 'GB'
  and lower(trim(city)) in (
    'swansea',
    'llanelli',
    'burry port',
    'neath'
  );
