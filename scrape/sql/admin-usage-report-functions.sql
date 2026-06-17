-- Admin usage report aggregates (replaces full-table scans in usage-stats.ts).

CREATE OR REPLACE FUNCTION public.admin_usage_audience_counts()
RETURNS TABLE(
  registered_free bigint,
  registered_pro bigint,
  csv_only_emails bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*)::bigint FROM public.profiles WHERE NOT is_pro) AS registered_free,
    (SELECT count(*)::bigint FROM public.profiles WHERE is_pro) AS registered_pro,
    (
      SELECT count(*)::bigint
      FROM public.csv_downloads d
      WHERE d.user_id IS NULL
        AND (d.email IS NULL OR btrim(d.email) = '')
    ) AS csv_only_emails;
$function$;

CREATE OR REPLACE FUNCTION public.admin_csv_download_stats(p_period_start timestamptz DEFAULT NULL)
RETURNS TABLE(
  segment text,
  actor_key text,
  download_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN d.user_id IS NULL THEN 'anonymous'
      WHEN p.is_pro THEN 'paid'
      ELSE 'free_logged_in'
    END AS segment,
    CASE
      WHEN d.user_id IS NOT NULL THEN d.user_id::text
      ELSE 'anon:' || d.page_url
    END AS actor_key,
    count(*)::bigint AS download_count
  FROM public.csv_downloads d
  LEFT JOIN public.profiles p ON p.id = d.user_id
  WHERE p_period_start IS NULL OR d.downloaded_at >= p_period_start
  GROUP BY segment, actor_key
  ORDER BY segment, actor_key;
$function$;

CREATE OR REPLACE FUNCTION public.admin_crm_usage_stats(p_period_start timestamptz DEFAULT NULL)
RETURNS TABLE(
  segment text,
  user_id uuid,
  action_type text,
  event_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN p.is_pro THEN 'paid'
      ELSE 'free_logged_in'
    END AS segment,
    e.user_id,
    e.event_type AS action_type,
    count(*)::bigint AS event_count
  FROM public.usage_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE p_period_start IS NULL OR e.created_at >= p_period_start
  GROUP BY segment, e.user_id, e.event_type
  ORDER BY segment, e.user_id, e.event_type;
$function$;

CREATE OR REPLACE FUNCTION public.admin_anonymous_csv_by_page(p_period_start timestamptz DEFAULT NULL)
RETURNS TABLE(
  page_url text,
  download_count bigint,
  last_downloaded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    d.page_url,
    count(*)::bigint AS download_count,
    max(d.downloaded_at) AS last_downloaded_at
  FROM public.csv_downloads d
  WHERE d.user_id IS NULL
    AND (p_period_start IS NULL OR d.downloaded_at >= p_period_start)
  GROUP BY d.page_url
  ORDER BY download_count DESC, d.page_url;
$function$;

-- Per-user activity report with retention, marketing opt-in, and outreach breakdown.
-- See admin-user-activity-breakdown.sql for event type constraint updates.

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
