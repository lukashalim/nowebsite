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
    e.action_type,
    count(*)::bigint AS event_count
  FROM public.crm_usage_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE p_period_start IS NULL OR e.created_at >= p_period_start
  GROUP BY segment, e.user_id, e.action_type
  ORDER BY segment, e.user_id, e.action_type;
$function$;
