alter table public.list_purchases
  add column if not exists buyer_email text,
  add column if not exists amount_cents integer,
  add column if not exists currency text,
  add column if not exists email_status text,
  add column if not exists resend_email_id text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text;

alter table public.list_purchases
  drop constraint if exists list_purchases_email_status_check;

alter table public.list_purchases
  add constraint list_purchases_email_status_check
  check (
    email_status is null
    or email_status in ('skipped', 'sent', 'failed')
  );

create index if not exists idx_list_purchases_created
  on public.list_purchases (created_at desc);
