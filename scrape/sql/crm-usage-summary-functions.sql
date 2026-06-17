-- Monthly CRM outreach usage aggregates (replaces per-row fetch + JS count).

CREATE OR REPLACE FUNCTION public.crm_usage_monthly_summary(p_user_id uuid)
RETURNS TABLE(
  action_type text,
  event_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE e.event_type
      WHEN 'facebook_dm_copied' THEN 'dm'
      WHEN 'sms_sent' THEN 'sms'
      WHEN 'demo_site_created' THEN 'demo_click'
    END AS action_type,
    count(*)::bigint AS event_count
  FROM public.usage_events e
  WHERE e.user_id = p_user_id
    AND e.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
    AND e.event_type IN ('facebook_dm_copied', 'sms_sent', 'demo_site_created')
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.crm_usage_monthly_total(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::bigint
  FROM public.usage_events e
  WHERE e.user_id = p_user_id
    AND e.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
    AND e.event_type IN ('facebook_dm_copied', 'sms_sent', 'demo_site_created');
$function$;
