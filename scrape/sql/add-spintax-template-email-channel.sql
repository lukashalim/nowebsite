-- Extend spintax template channel to support email templates.
-- Run in Supabase SQL editor (replay-safe).

alter table public.spintax_templates
  drop constraint if exists spintax_templates_channel_check;

alter table public.spintax_templates
  add constraint spintax_templates_channel_check
  check (channel in ('facebook', 'sms', 'call', 'email'));

comment on column public.spintax_templates.channel is
  'Delivery channel: facebook (DM copy), sms (text message), call (phone opener script), or email (subject + body). Audience still filters by lead type within each channel.';
