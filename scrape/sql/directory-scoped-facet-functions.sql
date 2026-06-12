-- State/city facet counts for scoped US directory listing pages (GROUP BY in SQL).

CREATE OR REPLACE FUNCTION public.directory_us_state_facet_index(p_state_values text[])
RETURNS TABLE(
  state text,
  city text,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    btrim(b.state) AS state,
    btrim(b.city) AS city,
    count(*)::bigint AS listing_count
  FROM public.businesses_nowebsite b
  WHERE b.has_website = false
    AND b.city IS NOT NULL AND btrim(b.city) <> ''
    AND b.state IS NOT NULL AND btrim(b.state) <> ''
    AND (b.country = 'US' OR b.country IS NULL)
    AND btrim(b.state) = ANY (p_state_values)
  GROUP BY btrim(b.state), btrim(b.city)
  ORDER BY btrim(b.state), listing_count DESC, btrim(b.city);
$function$;

CREATE OR REPLACE FUNCTION public.directory_us_facebook_facet_index()
RETURNS TABLE(
  state text,
  city text,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    btrim(state) AS state,
    btrim(city) AS city,
    count(*)::bigint AS listing_count
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND (country = 'US' OR country IS NULL)
    AND crm_contact_surface = 'facebook'
  GROUP BY btrim(state), btrim(city)
  ORDER BY btrim(state), listing_count DESC, btrim(city);
$function$;

CREATE OR REPLACE FUNCTION public.directory_us_category_facet_index(p_category_slug text)
RETURNS TABLE(
  state text,
  city text,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    btrim(state) AS state,
    btrim(city) AS city,
    count(*)::bigint AS listing_count
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND (country = 'US' OR country IS NULL)
    AND directory_category_slug = lower(btrim(p_category_slug))
  GROUP BY btrim(state), btrim(city)
  ORDER BY btrim(state), listing_count DESC, btrim(city);
$function$;

CREATE OR REPLACE FUNCTION public.directory_gb_region_facet_index(p_region_code text)
RETURNS TABLE(
  city text,
  state text,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    btrim(city) AS city,
    btrim(state) AS state,
    count(*)::bigint AS listing_count
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND city IS NOT NULL AND btrim(city) <> ''
    AND state IS NOT NULL AND btrim(state) <> ''
    AND country = 'GB'
    AND (
      lower(btrim(coalesce(region_code, ''))) = lower(btrim(p_region_code))
      OR lower(btrim(state)) = lower(
        CASE lower(btrim(p_region_code))
          WHEN 'england' THEN 'england'
          WHEN 'scotland' THEN 'scotland'
          WHEN 'wales' THEN 'wales'
          WHEN 'northern-ireland' THEN 'northern ireland'
          ELSE btrim(p_region_code)
        END
      )
    )
  GROUP BY btrim(city), btrim(state)
  ORDER BY listing_count DESC, btrim(city);
$function$;

CREATE OR REPLACE FUNCTION public.directory_gb_city_category_facet_index(
  p_city text,
  p_region_code text,
  p_category_slug text
)
RETURNS TABLE(
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::bigint AS listing_count
  FROM public.businesses_nowebsite
  WHERE has_website = false
    AND btrim(city) = btrim(p_city)
    AND country = 'GB'
    AND directory_category_slug = lower(btrim(p_category_slug))
    AND (
      lower(btrim(coalesce(region_code, ''))) = lower(btrim(p_region_code))
      OR lower(btrim(state)) = lower(
        CASE lower(btrim(p_region_code))
          WHEN 'england' THEN 'england'
          WHEN 'scotland' THEN 'scotland'
          WHEN 'wales' THEN 'wales'
          WHEN 'northern-ireland' THEN 'northern ireland'
          ELSE btrim(p_region_code)
        END
      )
    );
$function$;
