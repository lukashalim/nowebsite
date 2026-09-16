-- Classify existing Google Maps streets for postcard send (Lob USAV).
-- Run in Supabase SQL editor before npm run postcard:score-addresses.
-- Replay-safe. Does not overwrite Maps address/city/postal_code.

alter table public.businesses_nowebsite
  add column if not exists postcard_address_kind text,
  add column if not exists postcard_address_record_type text,
  add column if not exists postcard_address_is_cmra boolean,
  add column if not exists postcard_address_peer_count integer,
  add column if not exists postcard_address_checked_at timestamptz;

alter table public.businesses_nowebsite
  drop constraint if exists businesses_nowebsite_postcard_address_kind_check;

alter table public.businesses_nowebsite
  add constraint businesses_nowebsite_postcard_address_kind_check
  check (postcard_address_kind is null or postcard_address_kind in (
    'undeliverable',
    'cmra',
    'shared',
    'po_box',
    'commercial',
    'residential',
    'unknown'
  ));

comment on column public.businesses_nowebsite.postcard_address_kind is
  'Lob USAV + occupancy bucket for whether the Maps pin is a home/PO Box the owner is likely to see.';

comment on column public.businesses_nowebsite.postcard_address_record_type is
  'Raw Lob components.record_type (street, highrise, firm, po_box, rural_route, general_delivery).';

comment on column public.businesses_nowebsite.postcard_address_is_cmra is
  'True when Lob DPV marks a CMRA (UPS Store / mailbox service) or PMB components are set.';

comment on column public.businesses_nowebsite.postcard_address_peer_count is
  'Other businesses_nowebsite rows sharing the same normalized street + ZIP5.';

create index if not exists idx_businesses_nowebsite_postcard_address_kind
  on public.businesses_nowebsite (postcard_address_kind)
  where has_website = false and is_invalid = false;
