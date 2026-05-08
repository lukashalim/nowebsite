-- Applied to Supabase for mini CRM (contact_count + index).
-- Replay if setting up a fresh database.

alter table public.businesses
  add column if not exists contact_count integer not null default 0;

alter table public.businesses
  drop constraint if exists businesses_contact_count_check;

alter table public.businesses
  add constraint businesses_contact_count_check
  check (contact_count >= 0 and contact_count <= 50);

create index if not exists idx_businesses_crm_leads
  on public.businesses (reviews desc, rating desc)
  where has_website = false;
