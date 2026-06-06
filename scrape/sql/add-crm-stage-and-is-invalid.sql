-- CRM pipeline fields (per user) and global invalid listing flag.
-- Replaces businesses_nowebsite.contact_count = -1 ("dead") with is_invalid.
-- Run in Supabase SQL editor (replay-safe).

alter table public.businesses_nowebsite
  add column if not exists is_invalid boolean not null default false;

comment on column public.businesses_nowebsite.is_invalid is
  'Bad/closed/invalid listing (not a sales outcome). Hidden from CRM and demo cohorts when true.';

update public.businesses_nowebsite
set is_invalid = true,
    contact_count = 0
where contact_count = -1;

create index if not exists idx_businesses_nowebsite_crm_valid
  on public.businesses_nowebsite (reviews desc, rating desc)
  where is_invalid = false and has_website = false;

alter table public.crm_user_contacts
  add column if not exists stage text not null default 'new';

alter table public.crm_user_contacts
  drop constraint if exists crm_user_contacts_stage_check;

alter table public.crm_user_contacts
  add constraint crm_user_contacts_stage_check
  check (stage in ('new', 'replied', 'demo_sent', 'interested', 'closed'));

alter table public.crm_user_contacts
  add column if not exists owner_name text;

alter table public.crm_user_contacts
  add column if not exists notes text;

alter table public.crm_user_contacts
  drop constraint if exists crm_user_contacts_owner_name_check;

alter table public.crm_user_contacts
  add constraint crm_user_contacts_owner_name_check
  check (owner_name is null or char_length(owner_name) <= 100);

alter table public.crm_user_contacts
  drop constraint if exists crm_user_contacts_notes_check;

alter table public.crm_user_contacts
  add constraint crm_user_contacts_notes_check
  check (notes is null or char_length(notes) <= 2000);

create index if not exists idx_crm_user_contacts_user_stage
  on public.crm_user_contacts (user_id, stage);

comment on column public.crm_user_contacts.stage is
  'Per-user sales pipeline stage for CRM outreach.';

comment on column public.crm_user_contacts.owner_name is
  'Per-user contact owner name for this lead.';

comment on column public.crm_user_contacts.notes is
  'Per-user freeform notes for this lead.';
