-- City/state/category summary RPCs for the directory index.
-- Avoids loading 16k+ category-level buckets (PostgREST default 1000-row cap).

CREATE OR REPLACE FUNCTION public.directory_us_city_index(min_listings int DEFAULT 0)
RETURNS TABLE(
  city text,
  state text,
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
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND (country = 'US' OR country IS NULL)
  GROUP BY btrim(city), btrim(state)
  HAVING count(*) >= min_listings
  ORDER BY listing_count DESC, btrim(city), btrim(state);
$function$;

CREATE OR REPLACE FUNCTION public.directory_us_category_index()
RETURNS TABLE(
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
    main_category,
    business_type,
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND (country = 'US' OR country IS NULL)
  GROUP BY main_category, business_type
  ORDER BY listing_count DESC, main_category, business_type;
$function$;

CREATE OR REPLACE FUNCTION public.directory_us_state_index()
RETURNS TABLE(
  state text,
  listing_count bigint,
  last_modified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    btrim(state) AS state,
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND (country = 'US' OR country IS NULL)
  GROUP BY btrim(state)
  ORDER BY listing_count DESC, btrim(state);
$function$;

CREATE OR REPLACE FUNCTION public.directory_us_city_category_index(
  p_city text,
  p_state text
)
RETURNS TABLE(
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
    main_category,
    business_type,
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND btrim(city) = btrim(p_city)
    AND btrim(state) = btrim(p_state)
    AND (country = 'US' OR country IS NULL)
  GROUP BY main_category, business_type
  ORDER BY listing_count DESC, main_category, business_type;
$function$;
