-- Per-user CRM outreach spintax templates.
-- Run in Supabase SQL editor (replay-safe).

create table if not exists public.spintax_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  template text not null,
  created_at timestamptz not null default now(),
  constraint spintax_templates_name_check
    check (char_length(trim(name)) > 0),
  constraint spintax_templates_template_check
    check (char_length(template) > 0 and char_length(template) <= 4000)
);

create index if not exists idx_spintax_templates_user_created
  on public.spintax_templates (user_id, created_at);

alter table public.spintax_templates enable row level security;

drop policy if exists spintax_templates_select_own on public.spintax_templates;
create policy spintax_templates_select_own
  on public.spintax_templates for select
  using (auth.uid() = user_id);

drop policy if exists spintax_templates_insert_own on public.spintax_templates;
create policy spintax_templates_insert_own
  on public.spintax_templates for insert
  with check (auth.uid() = user_id);

drop policy if exists spintax_templates_update_own on public.spintax_templates;
create policy spintax_templates_update_own
  on public.spintax_templates for update
  using (auth.uid() = user_id);

drop policy if exists spintax_templates_delete_own on public.spintax_templates;
create policy spintax_templates_delete_own
  on public.spintax_templates for delete
  using (auth.uid() = user_id);

comment on table public.spintax_templates is
  'Per-user DM spintax templates for CRM outreach copy.';
