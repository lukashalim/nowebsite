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
  WITH profile_emails AS (
    SELECT
      lower(btrim(email)) AS email_norm,
      is_pro
    FROM public.profiles
    WHERE email IS NOT NULL AND btrim(email) <> ''
  ),
  csv_emails AS (
    SELECT DISTINCT lower(btrim(email)) AS email_norm
    FROM public.csv_downloads
    WHERE email IS NOT NULL AND btrim(email) <> ''
  )
  SELECT
    (SELECT count(*)::bigint FROM public.profiles WHERE NOT is_pro) AS registered_free,
    (SELECT count(*)::bigint FROM public.profiles WHERE is_pro) AS registered_pro,
    (
      SELECT count(*)::bigint
      FROM csv_emails c
      WHERE NOT EXISTS (
        SELECT 1 FROM profile_emails p WHERE p.email_norm = c.email_norm
      )
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
      WHEN p.id IS NULL THEN 'email_signup'
      WHEN p.is_pro THEN 'paid'
      ELSE 'free_logged_in'
    END AS segment,
    lower(btrim(d.email)) AS actor_key,
    count(*)::bigint AS download_count
  FROM public.csv_downloads d
  LEFT JOIN public.profiles p
    ON lower(btrim(p.email)) = lower(btrim(d.email))
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
    e.action_type,
    count(*)::bigint AS event_count
  FROM public.crm_usage_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE p_period_start IS NULL OR e.created_at >= p_period_start
  GROUP BY segment, e.user_id, e.action_type
  ORDER BY segment, e.user_id, e.action_type;
$function$;
