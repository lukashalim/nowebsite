-- Add lead-type audience to spintax templates (Facebook vs no Facebook).
-- Run in Supabase SQL editor (replay-safe).

alter table public.spintax_templates
  add column if not exists audience text not null default 'facebook';

alter table public.spintax_templates
  drop constraint if exists spintax_templates_audience_check;

alter table public.spintax_templates
  add constraint spintax_templates_audience_check
  check (audience in ('facebook', 'no_facebook', 'any'));

create index if not exists idx_spintax_templates_user_audience
  on public.spintax_templates (user_id, audience, created_at);

comment on column public.spintax_templates.audience is
  'Lead type this template targets: facebook, no_facebook, or any.';
