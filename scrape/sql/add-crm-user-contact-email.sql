-- Per-user CRM contact email for outreach (editable in call panel).
-- Run in Supabase SQL editor (replay-safe).

alter table public.crm_user_contacts
  add column if not exists contact_email text;

comment on column public.crm_user_contacts.contact_email is
  'User-saved email address for this lead; falls back to contact_enrichment when unset.';
