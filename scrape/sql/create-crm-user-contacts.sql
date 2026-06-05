-- Per-user CRM contacted counts (0–3). Global "dead" (-1) stays on businesses_nowebsite.contact_count.

create table if not exists public.crm_user_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.businesses_nowebsite(place_id) on delete cascade,
  contact_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id),
  constraint crm_user_contacts_count_check
    check (contact_count >= 0 and contact_count <= 3)
);

create index if not exists idx_crm_user_contacts_user_place
  on public.crm_user_contacts (user_id, place_id);

alter table public.crm_user_contacts enable row level security;

drop policy if exists crm_user_contacts_select_own on public.crm_user_contacts;
create policy crm_user_contacts_select_own
  on public.crm_user_contacts for select
  using (auth.uid() = user_id);

drop policy if exists crm_user_contacts_insert_own on public.crm_user_contacts;
create policy crm_user_contacts_insert_own
  on public.crm_user_contacts for insert
  with check (auth.uid() = user_id);

drop policy if exists crm_user_contacts_update_own on public.crm_user_contacts;
create policy crm_user_contacts_update_own
  on public.crm_user_contacts for update
  using (auth.uid() = user_id);

drop policy if exists crm_user_contacts_delete_own on public.crm_user_contacts;
create policy crm_user_contacts_delete_own
  on public.crm_user_contacts for delete
  using (auth.uid() = user_id);
