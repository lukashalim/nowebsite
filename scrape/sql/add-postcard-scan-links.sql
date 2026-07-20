-- Opaque postcard QR scan targets for Lob-native qr_code.redirect_url.
-- Long signed ?t= tokens were getting mangled through Lob's redirect wrapper.

create table if not exists public.postcard_scan_links (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  username text not null,
  slug text not null,
  is_test boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists postcard_scan_links_user_place_idx
  on public.postcard_scan_links (user_id, place_id);

alter table public.postcard_scan_links enable row level security;

comment on table public.postcard_scan_links is
  'Opaque postcard QR scan targets; Lob redirect_url points at /api/postcard-scan?id=…';
