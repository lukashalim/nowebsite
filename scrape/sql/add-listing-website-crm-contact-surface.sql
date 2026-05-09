-- Run in Supabase SQL editor (once). Adds Maps listing URL + CRM bucket for Facebook / WhatsApp / none.
-- Re-run safe: skips crm_contact_surface if it already exists.

alter table public.businesses_nowebsite
  add column if not exists listing_website text;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses_nowebsite'
      and column_name = 'crm_contact_surface'
  ) then
    alter table public.businesses_nowebsite
      add column crm_contact_surface text
      generated always as (
        case
          when nullif(trim(coalesce(facebook_url, '')), '') is not null then 'facebook'
          when listing_website is not null
            and nullif(trim(listing_website), '') is not null
            and listing_website ~* 'wa\.me|whatsapp\.com' then 'whatsapp'
          when listing_website is not null
            and nullif(trim(listing_website), '') is not null
            and listing_website ~* 'facebook\.com|fb\.com|fb\.me' then 'facebook'
          else 'none'
        end
      ) stored;
  end if;
end $$;

comment on column public.businesses_nowebsite.listing_website is
  'Raw Google Maps website field from scraper (may be Facebook / WhatsApp / real site).';

comment on column public.businesses_nowebsite.crm_contact_surface is
  'CRM filter bucket: facebook (enriched FB or FB-only listing URL), whatsapp (WA listing URL), or none.';

create index if not exists idx_businesses_nowebsite_crm_contact_surface
  on public.businesses_nowebsite (crm_contact_surface)
  where has_website = false;
