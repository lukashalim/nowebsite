-- Add test postcard event types; migrate historical rows (all were Lob test_ key).
-- Test events do NOT count toward free monthly outreach limits.

ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_event_type_check;

ALTER TABLE public.usage_events
  ADD CONSTRAINT usage_events_event_type_check CHECK (event_type IN (
    'demo_site_created',
    'facebook_dm_copied',
    'sms_sent',
    'csv_page_exported',
    'user_login',
    'phone_call_initiated',
    'lead_contact_revealed',
    'postcard_sent',
    'postcard_scanned',
    'postcard_sent_test',
    'postcard_scanned_test'
  ));

UPDATE public.usage_events
SET event_type = 'postcard_sent_test'
WHERE event_type = 'postcard_sent';

UPDATE public.usage_events
SET event_type = 'postcard_scanned_test'
WHERE event_type = 'postcard_scanned';
