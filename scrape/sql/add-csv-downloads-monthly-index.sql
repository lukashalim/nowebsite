-- Speed up monthly CSV download limit checks by email.

create index if not exists idx_csv_downloads_email_month
  on public.csv_downloads (lower(email), downloaded_at desc);
