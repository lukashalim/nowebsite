-- One-time: align business_type with hair-salon vs barber-shop split (category-merge.ts).
-- Run in Supabase after deploying app code. Safe to re-run (idempotent on main_category).

update public.businesses_nowebsite
set business_type = 'hair_salon', updated_at = now()
where lower(trim(coalesce(main_category, ''))) = 'hair salon';

update public.businesses_nowebsite
set business_type = 'beauty_salon', updated_at = now()
where lower(trim(coalesce(main_category, ''))) = 'beauty salon';

update public.businesses_nowebsite
set business_type = 'hairdresser', updated_at = now()
where lower(trim(coalesce(main_category, ''))) = 'hairdresser';

-- Barber-only rows when main_category is barber shop
update public.businesses_nowebsite
set business_type = 'barber_shop', updated_at = now()
where lower(trim(coalesce(main_category, ''))) in ('barber shop', 'barber')
  and (
    business_type is null
    or trim(business_type) = ''
    or lower(regexp_replace(trim(business_type), '[^a-z0-9]+', '_', 'g')) in (
      'local_cache',
      'hair_salon',
      'beauty_salon',
      'hairdresser',
      'barber'
    )
  );
