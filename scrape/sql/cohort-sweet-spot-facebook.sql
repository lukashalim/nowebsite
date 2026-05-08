-- Sweet spot: rating >= 4, reviews 75–200 (matches pipeline defaults).
-- businesses.facebook_url populated only after GMaps scrape with enable_emails_social.

-- Summary counts
SELECT
  count(*) FILTER (
    WHERE rating IS NOT NULL AND reviews IS NOT NULL
  ) AS rows_with_rating_reviews,
  count(*) FILTER (
    WHERE coalesce(rating, 0) >= 4 AND reviews BETWEEN 75 AND 200
  ) AS sweet_spot_total,
  count(*) FILTER (
    WHERE coalesce(rating, 0) >= 4
      AND reviews BETWEEN 75 AND 200
      AND (facebook_url IS NULL OR btrim(facebook_url) = '')
  ) AS sweet_spot_missing_facebook_url,
  count(*) FILTER (
    WHERE coalesce(rating, 0) >= 4
      AND reviews BETWEEN 75 AND 200
      AND facebook_url IS NOT NULL
      AND btrim(facebook_url) <> ''
  ) AS sweet_spot_has_facebook_url
FROM public.businesses;

-- Distinct ZIPs to target for re-dispatch (only rows with postal_code)
SELECT count(DISTINCT postal_code) AS distinct_zips_missing_fb
FROM public.businesses
WHERE coalesce(rating, 0) >= 4
  AND reviews BETWEEN 75 AND 200
  AND (facebook_url IS NULL OR btrim(facebook_url) = '')
  AND postal_code IS NOT NULL
  AND btrim(postal_code::text) <> '';

-- Top states (full name column, e.g. Florida)
SELECT state, count(*) AS n
FROM public.businesses
WHERE coalesce(rating, 0) >= 4
  AND reviews BETWEEN 75 AND 200
  AND (facebook_url IS NULL OR btrim(facebook_url) = '')
  AND state IS NOT NULL AND btrim(state) <> ''
GROUP BY state
ORDER BY n DESC;

-- ZIP list for one state + business_type (paste values)
-- SELECT DISTINCT postal_code
-- FROM public.businesses
-- WHERE coalesce(rating, 0) >= 4 AND reviews BETWEEN 75 AND 200
--   AND (facebook_url IS NULL OR btrim(facebook_url) = '')
--   AND state = 'Ohio'
--   AND business_type = 'lawn care'
-- ORDER BY 1;
