-- GB city/region/category summary RPCs for the directory index.
-- Avoids loading thousands of category-level buckets (PostgREST 1000-row cap).

CREATE OR REPLACE FUNCTION public.directory_gb_city_index(min_listings int DEFAULT 0)
RETURNS TABLE(
  city text,
  state text,
  region text,
  region_code text,
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
    lower(btrim(region_code)) AS region_code,
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND country = 'GB'
  GROUP BY btrim(city), btrim(state), region, lower(btrim(region_code))
  HAVING count(*) >= min_listings
  ORDER BY listing_count DESC, btrim(city), lower(btrim(region_code));
$function$;

CREATE OR REPLACE FUNCTION public.directory_gb_region_index(min_listings int DEFAULT 0)
RETURNS TABLE(
  region text,
  state text,
  region_code text,
  listing_count bigint,
  last_modified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    coalesce(nullif(btrim(region), ''), btrim(state)) AS region,
    btrim(state) AS state,
    lower(btrim(region_code)) AS region_code,
    count(*)::bigint AS listing_count,
    max(coalesce(last_checked, scraped_at)) AS last_modified_at
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND country = 'GB'
  GROUP BY btrim(state), region, lower(btrim(region_code))
  HAVING count(*) >= min_listings
  ORDER BY listing_count DESC, lower(btrim(region_code)), btrim(state);
$function$;

CREATE OR REPLACE FUNCTION public.directory_gb_city_category_index(
  p_city text,
  p_region_code text
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
    AND country = 'GB'
    AND (
      lower(btrim(coalesce(region_code, ''))) = lower(btrim(p_region_code))
      OR (
        (region_code IS NULL OR btrim(region_code) = '')
        AND lower(btrim(state)) = lower(
          CASE lower(btrim(p_region_code))
            WHEN 'england' THEN 'england'
            WHEN 'scotland' THEN 'scotland'
            WHEN 'wales' THEN 'wales'
            WHEN 'northern-ireland' THEN 'northern ireland'
            ELSE btrim(p_region_code)
          END
        )
      )
    )
  GROUP BY main_category, business_type
  ORDER BY listing_count DESC, main_category, business_type;
$function$;
