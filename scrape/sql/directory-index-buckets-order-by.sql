-- Stable row order for paginated directory_us_index_buckets / directory_gb_index_buckets RPC calls.
-- PostgREST defaults to 1000 rows; the app paginates with .range() and needs deterministic ordering.

CREATE OR REPLACE FUNCTION public.directory_us_index_buckets()
RETURNS TABLE(
  city text,
  state text,
  main_category text,
  business_type text,
  listing_count bigint,
  last_modified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    btrim(city) AS city,
    btrim(state) AS state,
    main_category,
    business_type,
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND (country = 'US' OR country IS NULL)
  GROUP BY btrim(city), btrim(state), main_category, business_type
  ORDER BY btrim(city), btrim(state), main_category, business_type;
$function$;

CREATE OR REPLACE FUNCTION public.directory_gb_index_buckets()
RETURNS TABLE(
  city text,
  state text,
  region text,
  region_code text,
  main_category text,
  business_type text,
  listing_count bigint,
  last_modified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    btrim(city) AS city,
    btrim(state) AS state,
    region,
    region_code,
    main_category,
    business_type,
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND country = 'GB'
  GROUP BY btrim(city), btrim(state), region, region_code, main_category, business_type
  ORDER BY btrim(city), btrim(state), region, region_code, main_category, business_type;
$function$;
