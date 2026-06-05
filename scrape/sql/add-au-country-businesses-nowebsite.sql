-- Allow Australia in businesses_nowebsite.country (ingest + CRM; no public directory yet).

alter table public.businesses_nowebsite
  drop constraint if exists businesses_nowebsite_country_check;

alter table public.businesses_nowebsite
  add constraint businesses_nowebsite_country_check
  check (country in ('US', 'GB', 'AU'));

comment on column public.businesses_nowebsite.country is
  'Market: US (default), GB, or AU.';

-- Backfill AU where postcode or state indicates Australia (rows previously mislabeled US).
update public.businesses_nowebsite
set country = 'AU'
where country = 'US'
  and (
    postal_code ~ '^\d{4}$'
    and lower(trim(coalesce(state, ''))) in (
      'nsw', 'vic', 'qld', 'sa', 'wa', 'tas', 'nt', 'act',
      'new south wales', 'victoria', 'queensland', 'south australia',
      'western australia', 'tasmania', 'northern territory',
      'australian capital territory'
    )
  );
