-- Per-user activity breakdown: logins, DM, SMS, phone calls, demo clicks.
-- Applied via Supabase MCP (project hihupmzzlgxotxwcknjh).

ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_event_type_check;

ALTER TABLE public.usage_events
  ADD CONSTRAINT usage_events_event_type_check
  CHECK (event_type IN (
    'demo_site_created',
    'facebook_dm_copied',
    'sms_sent',
    'csv_page_exported',
    'user_login',
    'phone_call_initiated'
  ));

-- Backfill one login event for users who already have first_login tracked.
INSERT INTO public.usage_events (user_id, event_type, created_at)
SELECT p.id, 'user_login', p.first_login
FROM public.profiles p
WHERE p.first_login IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.usage_events e
    WHERE e.user_id = p.id
      AND e.event_type = 'user_login'
  );

DROP FUNCTION IF EXISTS public.admin_user_activity_report(timestamptz);

CREATE FUNCTION public.admin_user_activity_report(p_period_start timestamptz DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  email text,
  is_pro boolean,
  first_login timestamptz,
  last_login timestamptz,
  marketing_opt_in boolean,
  last_sign_in_at timestamptz,
  csv_download_count bigint,
  login_count bigint,
  dm_count bigint,
  sms_count bigint,
  phone_call_count bigint,
  demo_click_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id AS user_id,
    coalesce(p.email, u.email) AS email,
    p.is_pro,
    p.first_login,
    p.last_login,
    p.marketing_opt_in,
    u.last_sign_in_at,
    coalesce(csv.download_count, 0)::bigint AS csv_download_count,
    coalesce(events.login_count, 0)::bigint AS login_count,
    coalesce(events.dm_count, 0)::bigint AS dm_count,
    coalesce(events.sms_count, 0)::bigint AS sms_count,
    coalesce(events.phone_call_count, 0)::bigint AS phone_call_count,
    coalesce(events.demo_click_count, 0)::bigint AS demo_click_count
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.id
  LEFT JOIN (
    SELECT
      d.user_id,
      count(*)::bigint AS download_count
    FROM public.csv_downloads d
    WHERE d.user_id IS NOT NULL
      AND (p_period_start IS NULL OR d.downloaded_at >= p_period_start)
    GROUP BY d.user_id
  ) csv ON csv.user_id = p.id
  LEFT JOIN (
    SELECT
      e.user_id,
      count(*) FILTER (WHERE e.event_type = 'user_login')::bigint AS login_count,
      count(*) FILTER (WHERE e.event_type = 'facebook_dm_copied')::bigint AS dm_count,
      count(*) FILTER (WHERE e.event_type = 'sms_sent')::bigint AS sms_count,
      count(*) FILTER (WHERE e.event_type = 'phone_call_initiated')::bigint AS phone_call_count,
      count(*) FILTER (WHERE e.event_type = 'demo_site_created')::bigint AS demo_click_count
    FROM public.usage_events e
    WHERE p_period_start IS NULL OR e.created_at >= p_period_start
    GROUP BY e.user_id
  ) events ON events.user_id = p.id
  ORDER BY p.last_login DESC NULLS LAST, u.last_sign_in_at DESC NULLS LAST, p.email;
$function$;
