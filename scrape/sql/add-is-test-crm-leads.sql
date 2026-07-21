-- Mark internal QA/test leads separately from real outreach leads.
-- Filtering in the CRM app uses businesses_nowebsite.is_test
-- (crm_user_contacts.is_test is kept for data parity).

alter table public.businesses_nowebsite
  add column if not exists is_test boolean not null default false;

alter table public.crm_user_contacts
  add column if not exists is_test boolean not null default false;

comment on column public.businesses_nowebsite.is_test is
  'Internal QA/test lead; excluded from CRM list/export unless Show test leads is on.';

comment on column public.crm_user_contacts.is_test is
  'Internal QA/test contact row; mirrors businesses_nowebsite.is_test for the owning user.';

create index if not exists idx_businesses_nowebsite_is_test
  on public.businesses_nowebsite (is_test)
  where is_test = true;
