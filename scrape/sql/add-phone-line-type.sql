-- Persist Telnyx carrier lookup line type for CRM filtering.
-- Run in Supabase SQL editor before backfill or CRM filter goes live.

alter table public.businesses_nowebsite
  add column if not exists phone_line_type text,
  add column if not exists phone_line_type_checked_at timestamptz;

alter table public.businesses_nowebsite
  drop constraint if exists businesses_nowebsite_phone_line_type_check;

alter table public.businesses_nowebsite
  add constraint businesses_nowebsite_phone_line_type_check
  check (phone_line_type is null or phone_line_type in (
    'mobile', 'landline_or_voip', 'unknown'
  ));

create index if not exists idx_businesses_nowebsite_phone_line_type
  on public.businesses_nowebsite (phone_line_type)
  where phone_line_type is not null;
