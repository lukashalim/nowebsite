-- Merge secondary category business_type values into canonical primaries.
-- Run in Supabase SQL editor after deploying app redirects (category-merge.ts).
-- Replay-safe: only updates rows still using legacy types.

update public.businesses_nowebsite as b
set
  business_type = v.canonical,
  updated_at = now()
from (
  values
    ('barber', 'barber_shop'),
    ('hair_salon', 'barber_shop'),
    ('beauty_salon', 'barber_shop'),
    ('hairdresser', 'barber_shop'),
    ('laundry_service', 'laundromat'),
    ('laundry', 'laundromat'),
    ('dental_clinic', 'dentist'),
    ('massage_therapist', 'massage_spa'),
    ('american_restaurant', 'restaurant'),
    ('mexican_restaurant', 'restaurant'),
    ('takeout_restaurant', 'restaurant'),
    ('barbecue_restaurant', 'restaurant'),
    ('breakfast_restaurant', 'restaurant'),
    ('fast_food_restaurant', 'restaurant'),
    ('family_restaurant', 'restaurant'),
    ('bar_grill', 'restaurant'),
    ('lawn_care_service', 'landscaper'),
    ('gardener', 'landscaper'),
    ('pub', 'bar'),
    ('cleaners', 'dry_cleaner'),
    ('cleaner', 'dry_cleaner'),
    ('pet_store', 'pet_groomer'),
    ('pet_supply_store', 'pet_groomer'),
    ('heating_contractor', 'hvac_contractor')
) as v(legacy, canonical)
where lower(
  regexp_replace(trim(coalesce(b.business_type, '')), '[^a-z0-9]+', '_', 'g')
) = v.legacy;

-- main_category fallbacks when business_type is empty or placeholder
update public.businesses_nowebsite as b
set
  main_category = v.canonical,
  updated_at = now()
from (
  values
    ('barber', 'barber_shop'),
    ('hair_salon', 'barber_shop'),
    ('beauty_salon', 'barber_shop'),
    ('hairdresser', 'barber_shop'),
    ('laundry_service', 'laundromat'),
    ('laundry', 'laundromat'),
    ('dental_clinic', 'dentist'),
    ('massage_therapist', 'massage_spa'),
    ('american_restaurant', 'restaurant'),
    ('mexican_restaurant', 'restaurant'),
    ('takeout_restaurant', 'restaurant'),
    ('barbecue_restaurant', 'restaurant'),
    ('breakfast_restaurant', 'restaurant'),
    ('fast_food_restaurant', 'restaurant'),
    ('family_restaurant', 'restaurant'),
    ('bar_grill', 'restaurant'),
    ('lawn_care_service', 'landscaper'),
    ('gardener', 'landscaper'),
    ('pub', 'bar'),
    ('cleaners', 'dry_cleaner'),
    ('cleaner', 'dry_cleaner'),
    ('pet_store', 'pet_groomer'),
    ('pet_supply_store', 'pet_groomer'),
    ('heating_contractor', 'hvac_contractor')
) as v(legacy, canonical)
where (
  b.business_type is null
  or trim(b.business_type) = ''
  or lower(regexp_replace(trim(b.business_type), '[^a-z0-9]+', '_', 'g')) = 'local_cache'
)
and lower(
  regexp_replace(trim(coalesce(b.main_category, '')), '[^a-z0-9]+', '_', 'g')
) = v.legacy;
