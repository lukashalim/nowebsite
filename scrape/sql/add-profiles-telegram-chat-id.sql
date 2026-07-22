-- Per-user Telegram chat for postcard QR scan alerts.
-- Platform bot token lives in TELEGRAM_BOT_TOKEN env; chat id is per profile.

alter table public.profiles
  add column if not exists telegram_chat_id text;

comment on column public.profiles.telegram_chat_id is
  'Telegram chat id for postcard scan alerts (Bot API sendMessage). Empty = alerts off.';
