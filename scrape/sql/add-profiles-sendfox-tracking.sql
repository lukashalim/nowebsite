-- Track SendFox list subscription and double opt-in confirmation per CRM user.

alter table public.profiles
  add column if not exists sendfox_subscribed_at timestamptz,
  add column if not exists sendfox_confirmed_at timestamptz;

create index if not exists idx_profiles_sendfox_confirmed_at
  on public.profiles (sendfox_confirmed_at)
  where sendfox_confirmed_at is not null;
