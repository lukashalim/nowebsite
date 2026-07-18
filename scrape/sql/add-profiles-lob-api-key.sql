-- Per-user Lob API key for CRM postcards (BYOT).
-- lob_api_key is server-only; never returned to client reads.
-- Mode (test vs live) is inferred from key prefix: test_ → test, otherwise live.

alter table public.profiles
  add column if not exists lob_api_key text;

comment on column public.profiles.lob_api_key is
  'User Lob secret API key (write-only from client; server reads via admin). test_ keys never mail physically.';
