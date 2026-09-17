-- Split mail-first emergency/high-ticket trades into their own Industry group.
-- Replay-safe. Leaves remaining home-services slugs (incl. garage-door-supplier
-- and gutter-cleaning-service) on home-services.

insert into public.category_groups (id, label, description, display_order)
values
  (
    'home-services-high-opportunity',
    'Home Services — High opportunity',
    'Mail-first. Emergency, high-ticket, owner-operator trades.',
    1
  )
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order,
  updated_at = now();

update public.category_groups
set
  description = 'On-site home and property trades that are not in the high-opportunity mail-first bucket — cleaning, landscaping, painting, handyman, stores, and similar.',
  display_order = 2,
  updated_at = now()
where id = 'home-services';

update public.category_groups
set display_order = 3, updated_at = now()
where id = 'food-hospitality';

update public.category_groups
set display_order = 4, updated_at = now()
where id = 'professional';

update public.category_groups
set display_order = 5, updated_at = now()
where id = 'health-wellness';

update public.category_groups
set display_order = 6, updated_at = now()
where id = 'other';

update public.category_group_members
set group_id = 'home-services-high-opportunity'
where category_slug in (
  'air-conditioning-contractor',
  'air-conditioning-repair-service',
  'arborist-service',
  'bathroom-remodeler',
  'building-restoration-service',
  'chimney-services',
  'chimney-sweep',
  'concrete-contractor',
  'deck-builder',
  'electrical-installation-service',
  'electrician',
  'fence-contractor',
  'fire-damage-restoration-service',
  'furnace-repair-service',
  'gutter-service',
  'hvac-contractor',
  'insulation-contractor',
  'kitchen-remodeler',
  'masonry-contractor',
  'paving-contractor',
  'pest-control-service',
  'plumber',
  'remodeler',
  'roofer',
  'septic-system-service',
  'siding-contractor',
  'swimming-pool-contractor',
  'swimming-pool-repair-service',
  'tree-service',
  'water-damage-restoration-service',
  'waterproofing-service',
  'well-drilling-contractor',
  'window-installation-service'
);
