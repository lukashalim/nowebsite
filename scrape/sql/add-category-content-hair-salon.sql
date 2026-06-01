-- Editorial copy for /hair-salon (canonical slug after category split).
-- Run in Supabase SQL editor after create-category-content.sql exists.

insert into public.category_content (
  slug,
  display_name,
  pitch,
  outreach_angle,
  display_order,
  updated_at
)
values (
  'hair-salon',
  'Hair Salon',
  'Browse hair salons, beauty salons, and hairdressers on Google Maps that do not have their own website — grouped by city with ratings, phones, and Maps links for outreach.',
  'Many salons still rely on Instagram or booking links instead of a site they control. A simple portfolio site with services, pricing, and online booking helps capture search traffic and makes outreach easy to justify.',
  31,
  now()
)
on conflict (slug) do update set
  display_name = excluded.display_name,
  pitch = excluded.pitch,
  outreach_angle = excluded.outreach_angle,
  display_order = excluded.display_order,
  updated_at = now();
