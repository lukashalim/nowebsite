create table public.ringready_sms_opt_ins (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  consented_at timestamptz not null default now(),
  consent_version text not null default '2026-06',
  source text not null default 'ringreadysite.com',
  created_at timestamptz not null default now()
);

create unique index ringready_sms_opt_ins_phone_e164_key
  on public.ringready_sms_opt_ins (phone_e164);

alter table public.ringready_sms_opt_ins enable row level security;
