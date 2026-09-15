-- First-party visit / call-click events for live client sites.

create table if not exists public.client_site_events (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  event_type text not null,
  link_location text,
  created_at timestamptz not null default now(),
  constraint client_site_events_type_check
    check (event_type in ('page_view', 'click_to_call'))
);

create index if not exists client_site_events_site_type_created_idx
  on public.client_site_events (site_id, event_type, created_at);

alter table public.client_site_events enable row level security;

revoke all on table public.client_site_events from anon, authenticated;
grant all on table public.client_site_events to service_role;
