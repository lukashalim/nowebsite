-- Coverage and quality checks for demo SEO fields.

-- Overall coverage in the no-website cohort.
select
  count(*) as cohort_total,
  count(*) filter (
    where review_highlights is not null
      and jsonb_typeof(review_highlights) = 'array'
      and jsonb_array_length(review_highlights) > 0
  ) as with_review_highlights,
  count(*) filter (
    where services_offered is not null
      and cardinality(services_offered) > 0
  ) as with_services_offered,
  count(*) filter (
    where hours is not null
  ) as with_hours,
  count(*) filter (
    where open_now is not null
  ) as with_open_now
from public.businesses
where has_website = false;

-- Distribution by business type.
select
  business_type,
  count(*) as n,
  count(*) filter (
    where review_highlights is not null
      and jsonb_typeof(review_highlights) = 'array'
      and jsonb_array_length(review_highlights) > 0
  ) as with_review_highlights,
  count(*) filter (
    where services_offered is not null and cardinality(services_offered) > 0
  ) as with_services
from public.businesses
where has_website = false
group by business_type
order by n desc;

-- Sample rows for manual QA.
select
  place_id,
  name,
  business_type,
  city,
  state,
  reviews,
  rating,
  open_now,
  services_offered,
  review_highlights
from public.businesses
where has_website = false
  and review_highlights is not null
order by reviews desc nulls last
limit 25;
