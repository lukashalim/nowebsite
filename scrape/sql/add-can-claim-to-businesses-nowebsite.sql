-- Applied via Supabase MCP (project hihupmzzlgxotxwcknjh).
-- google_maps_scraper field: CAN_CLAIM / can_claim

alter table public.businesses_nowebsite
  add column if not exists can_claim boolean;

comment on column public.businesses_nowebsite.can_claim is
  'From google_maps_scraper CAN_CLAIM: listing eligible to be claimed on Google Maps.';
