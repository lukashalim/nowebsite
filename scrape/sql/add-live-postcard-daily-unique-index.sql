-- One live postcard per CRM user + lead (place_id) per UTC calendar day.
-- Test sends (postcard_sent_test) are not constrained.
--
-- Unique index cannot be created while duplicate live sends already exist
-- for the same (user_id, lead_id, UTC day). App-level enforcement still
-- blocks further same-day live sends. After duplicates are cleaned, apply:
--
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_one_live_postcard_per_user_lead_day
-- ON public.usage_events (
--   user_id,
--   lead_id,
--   ((timezone('UTC', created_at))::date)
-- )
-- WHERE event_type = 'postcard_sent' AND lead_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_one_live_postcard_per_user_lead_day
ON public.usage_events (
  user_id,
  lead_id,
  ((timezone('UTC', created_at))::date)
)
WHERE event_type = 'postcard_sent' AND lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_live_postcard_lead_day
ON public.usage_events (user_id, lead_id, created_at DESC)
WHERE event_type = 'postcard_sent';
