-- Extend spintax template channel to support call scripts.
-- Run in Supabase SQL editor (replay-safe).

alter table public.spintax_templates
  drop constraint if exists spintax_templates_channel_check;

alter table public.spintax_templates
  add constraint spintax_templates_channel_check
  check (channel in ('facebook', 'sms', 'call'));

comment on column public.spintax_templates.channel is
  'Delivery channel: facebook (DM copy), sms (text message), or call (phone opener script). Audience still filters by lead type within each channel.';
