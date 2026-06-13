-- Seed a CRM test lead for outbound call testing (240-582-3272).
-- Replay-safe: run in Supabase SQL editor or via migration tooling.

INSERT INTO public.businesses_nowebsite (
  place_id,
  demo_slug,
  name,
  address,
  city,
  state,
  country,
  postal_code,
  main_category,
  business_type,
  rating,
  reviews,
  has_website,
  is_invalid,
  phone,
  review_highlights
) VALUES (
  'ChIJ_TEST_LUKAS_CALL',
  'test-lukas-call',
  'TEST — Lukas Call Lead',
  '123 Test Street',
  'Bethesda',
  'MD',
  'US',
  '20814',
  'Plumber',
  'plumber',
  4.8,
  50,
  false,
  false,
  '2405823272',
  '[{"excerpt": "Test review excerpt for CRM call testing.", "rating": 5}]'::jsonb
)
ON CONFLICT (place_id) DO UPDATE SET
  demo_slug = EXCLUDED.demo_slug,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  postal_code = EXCLUDED.postal_code,
  main_category = EXCLUDED.main_category,
  business_type = EXCLUDED.business_type,
  rating = EXCLUDED.rating,
  reviews = EXCLUDED.reviews,
  has_website = EXCLUDED.has_website,
  is_invalid = EXCLUDED.is_invalid,
  phone = EXCLUDED.phone,
  review_highlights = EXCLUDED.review_highlights,
  updated_at = now();

INSERT INTO public.crm_user_contacts (user_id, place_id, contact_count, stage, notes)
SELECT
  p.id,
  'ChIJ_TEST_LUKAS_CALL',
  0,
  'new',
  'Test lead for outbound call testing — safe to delete.'
FROM public.profiles p
WHERE p.email = 'lukas.halim@gmail.com'
ON CONFLICT (user_id, place_id) DO UPDATE SET
  notes = EXCLUDED.notes;
