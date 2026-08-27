-- One-time $9 full-list CSV purchases (Embedded Checkout fulfillment).

create table if not exists public.list_purchases (
  stripe_session_id text primary key,
  scope_kind text not null,
  scope_slug text not null,
  filters jsonb not null default '{}'::jsonb,
  total_rows integer not null,
  free_rows_given integer not null default 100,
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'failed')),
  storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  buyer_email text,
  amount_cents integer,
  currency text,
  email_status text
    check (email_status is null or email_status in ('skipped', 'sent', 'failed')),
  resend_email_id text,
  email_sent_at timestamptz,
  email_error text
);

create index if not exists idx_list_purchases_status_created
  on public.list_purchases (status, created_at desc);

create index if not exists idx_list_purchases_created
  on public.list_purchases (created_at desc);

alter table public.list_purchases enable row level security;

-- Private bucket for generated CSVs (service role uploads; signed URLs for download).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'list-purchase-csvs',
  'list-purchase-csvs',
  false,
  52428800,
  array['text/csv', 'application/octet-stream']
)
on conflict (id) do nothing;
