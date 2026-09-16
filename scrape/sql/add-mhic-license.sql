-- Persist Maryland Home Improvement Commission (MHIC) lookup onto the same lead row.
-- Run in Supabase SQL editor before npm run enrich-md-mhic.
-- Replay-safe. Does not overwrite Google Maps address/city/postal_code.

alter table public.businesses_nowebsite
  add column if not exists mhic_match boolean,
  add column if not exists mhic_license_number text,
  add column if not exists mhic_suffix text,
  add column if not exists mhic_legal_name text,
  add column if not exists mhic_trade_name text,
  add column if not exists mhic_category text,
  add column if not exists mhic_expiration_date date,
  add column if not exists mhic_address text,
  add column if not exists mhic_city text,
  add column if not exists mhic_state text,
  add column if not exists mhic_zip text,
  add column if not exists mhic_checked_at timestamptz;

comment on column public.businesses_nowebsite.mhic_match is
  'True only when enrich-md-mhic found a confident MHIC license match for this existing row.';

comment on column public.businesses_nowebsite.mhic_license_number is
  'MHIC registration number from the official Maryland license search.';

comment on column public.businesses_nowebsite.mhic_trade_name is
  'MHIC trade/DBA name. Maps listing name stays on name.';

comment on column public.businesses_nowebsite.mhic_address is
  'MHIC mailing street. Maps address stays on address.';

create index if not exists idx_businesses_nowebsite_mhic_unchecked
  on public.businesses_nowebsite (id)
  where mhic_checked_at is null and is_invalid = false;
