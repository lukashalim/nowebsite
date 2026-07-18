-- Allow postcard_scanned engagement events (QR redirect hits).
-- Does NOT count toward free monthly outreach limits.

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
    'postcard_scanned'
  ));
