-- Add delivery channel to spintax templates (Facebook DM vs SMS).
-- Run in Supabase SQL editor (replay-safe).

alter table public.spintax_templates
  add column if not exists channel text not null default 'facebook';

alter table public.spintax_templates
  drop constraint if exists spintax_templates_channel_check;

alter table public.spintax_templates
  add constraint spintax_templates_channel_check
  check (channel in ('facebook', 'sms'));

create index if not exists idx_spintax_templates_user_channel
  on public.spintax_templates (user_id, channel, created_at);

comment on column public.spintax_templates.channel is
  'Delivery channel: facebook (DM copy) or sms (text message). Audience still filters by lead type within each channel.';
