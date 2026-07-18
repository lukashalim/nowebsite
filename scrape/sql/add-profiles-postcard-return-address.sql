-- Per-user postcard return ("from") address for Lob.
-- Stored as JSON matching LobAddress fields (name, address_line1, …).

alter table public.profiles
  add column if not exists postcard_return_address jsonb;

comment on column public.profiles.postcard_return_address is
  'Lob from-address for CRM postcards: {name, address_line1, address_line2?, address_city, address_state, address_zip, address_country?}';
