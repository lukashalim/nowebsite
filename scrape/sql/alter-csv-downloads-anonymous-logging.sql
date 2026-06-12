-- Allow anonymous directory CSV download logging (no email gate).

alter table public.csv_downloads alter column email drop not null;

alter table public.csv_downloads
  add column if not exists user_id uuid references auth.users (id);

create index if not exists idx_csv_downloads_user_id
  on public.csv_downloads (user_id);
