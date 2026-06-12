-- Per-user Twilio credentials for Pro communications (BYOT).
-- twilio_auth_token is server-only; never returned to client reads.

alter table public.profiles
  add column if not exists twilio_account_sid text,
  add column if not exists twilio_auth_token text,
  add column if not exists twilio_phone_number text,
  add column if not exists forwarding_number text;

comment on column public.profiles.twilio_account_sid is
  'User Twilio Account SID for branded outbound call/SMS';
comment on column public.profiles.twilio_auth_token is
  'User Twilio Auth Token (write-only from client; server reads via admin)';
comment on column public.profiles.twilio_phone_number is
  'E.164 Twilio number used as caller ID / SMS From';
comment on column public.profiles.forwarding_number is
  'E.164 phone that rings first on outbound Twilio calls';
