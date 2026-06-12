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
    action_type,
    count(*)::bigint AS event_count
  FROM public.crm_usage_events
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
  GROUP BY action_type
  ORDER BY action_type;
$function$;

CREATE OR REPLACE FUNCTION public.crm_usage_monthly_total(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::bigint
  FROM public.crm_usage_events
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC');
$function$;
