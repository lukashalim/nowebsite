-- Store Lob test and live keys separately.
-- lob_api_key remains the live/production key.
-- Existing test_ keys are moved into lob_test_api_key.

alter table public.profiles
  add column if not exists lob_test_api_key text;

comment on column public.profiles.lob_api_key is
  'User Lob live/production secret API key (write-only from client; server reads via admin).';

comment on column public.profiles.lob_test_api_key is
  'User Lob test_ secret API key for postcard proofs (write-only from client; server reads via admin).';

update public.profiles
set
  lob_test_api_key = coalesce(lob_test_api_key, lob_api_key),
  lob_api_key = null
where lob_api_key is not null
  and lob_api_key like 'test_%'
  and (lob_test_api_key is null or lob_test_api_key = '');
