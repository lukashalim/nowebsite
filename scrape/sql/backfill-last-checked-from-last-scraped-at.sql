-- Consolidate on last_checked: copy legacy last_scraped_at where check time was never set.

update public.businesses_nowebsite
set last_checked = last_scraped_at
where last_checked is null
  and last_scraped_at is not null;
