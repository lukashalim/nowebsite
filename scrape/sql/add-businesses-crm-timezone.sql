-- US continental time zone bucket for CRM filtering (whole-state assignment).
-- Replay-safe: run in Supabase SQL editor or via apply_migration.

alter table public.businesses_nowebsite
  add column if not exists crm_timezone text;

alter table public.businesses_nowebsite
  drop constraint if exists businesses_nowebsite_crm_timezone_check;

alter table public.businesses_nowebsite
  add constraint businesses_nowebsite_crm_timezone_check
  check (
    crm_timezone is null
    or crm_timezone in ('eastern', 'central', 'mountain', 'pacific')
  );

create index if not exists idx_businesses_nowebsite_crm_timezone
  on public.businesses_nowebsite (crm_timezone)
  where crm_timezone is not null;

comment on column public.businesses_nowebsite.crm_timezone is
  'US CRM call-time bucket derived from state: eastern, central, mountain, or pacific. Null for AK/HI and non-US.';

-- Normalize state to lowercase 2-letter abbr (full name or abbr input).
create or replace function public.crm_us_state_abbr(state text)
returns text
language plpgsql
immutable
as $$
declare
  raw text;
  key text;
begin
  if state is null then
    return null;
  end if;
  raw := lower(trim(state));
  if raw = '' then
    return null;
  end if;
  if length(raw) = 2 then
    return raw;
  end if;

  key := raw;
  return case key
    when 'alabama' then 'al'
    when 'alaska' then 'ak'
    when 'arizona' then 'az'
    when 'arkansas' then 'ar'
    when 'california' then 'ca'
    when 'colorado' then 'co'
    when 'connecticut' then 'ct'
    when 'delaware' then 'de'
    when 'florida' then 'fl'
    when 'georgia' then 'ga'
    when 'hawaii' then 'hi'
    when 'idaho' then 'id'
    when 'illinois' then 'il'
    when 'indiana' then 'in'
    when 'iowa' then 'ia'
    when 'kansas' then 'ks'
    when 'kentucky' then 'ky'
    when 'louisiana' then 'la'
    when 'maine' then 'me'
    when 'maryland' then 'md'
    when 'massachusetts' then 'ma'
    when 'michigan' then 'mi'
    when 'minnesota' then 'mn'
    when 'mississippi' then 'ms'
    when 'missouri' then 'mo'
    when 'montana' then 'mt'
    when 'nebraska' then 'ne'
    when 'nevada' then 'nv'
    when 'new hampshire' then 'nh'
    when 'new jersey' then 'nj'
    when 'new mexico' then 'nm'
    when 'new york' then 'ny'
    when 'north carolina' then 'nc'
    when 'north dakota' then 'nd'
    when 'ohio' then 'oh'
    when 'oklahoma' then 'ok'
    when 'oregon' then 'or'
    when 'pennsylvania' then 'pa'
    when 'rhode island' then 'ri'
    when 'south carolina' then 'sc'
    when 'south dakota' then 'sd'
    when 'tennessee' then 'tn'
    when 'texas' then 'tx'
    when 'utah' then 'ut'
    when 'vermont' then 'vt'
    when 'virginia' then 'va'
    when 'washington' then 'wa'
    when 'west virginia' then 'wv'
    when 'wisconsin' then 'wi'
    when 'wyoming' then 'wy'
    when 'district of columbia' then 'dc'
    else null
  end;
end;
$$;

create or replace function public.crm_timezone_for_us_state(state text)
returns text
language plpgsql
immutable
as $$
declare
  abbr text;
begin
  abbr := public.crm_us_state_abbr(state);
  if abbr is null then
    return null;
  end if;

  return case abbr
    when 'ct' then 'eastern'
    when 'de' then 'eastern'
    when 'dc' then 'eastern'
    when 'fl' then 'eastern'
    when 'ga' then 'eastern'
    when 'in' then 'eastern'
    when 'ky' then 'eastern'
    when 'me' then 'eastern'
    when 'md' then 'eastern'
    when 'ma' then 'eastern'
    when 'mi' then 'eastern'
    when 'nh' then 'eastern'
    when 'nj' then 'eastern'
    when 'ny' then 'eastern'
    when 'nc' then 'eastern'
    when 'oh' then 'eastern'
    when 'pa' then 'eastern'
    when 'ri' then 'eastern'
    when 'sc' then 'eastern'
    when 'tn' then 'eastern'
    when 'vt' then 'eastern'
    when 'va' then 'eastern'
    when 'wv' then 'eastern'
    when 'al' then 'central'
    when 'ar' then 'central'
    when 'il' then 'central'
    when 'ia' then 'central'
    when 'ks' then 'central'
    when 'la' then 'central'
    when 'mn' then 'central'
    when 'ms' then 'central'
    when 'mo' then 'central'
    when 'ne' then 'central'
    when 'nd' then 'central'
    when 'ok' then 'central'
    when 'sd' then 'central'
    when 'tx' then 'central'
    when 'wi' then 'central'
    when 'az' then 'mountain'
    when 'co' then 'mountain'
    when 'id' then 'mountain'
    when 'mt' then 'mountain'
    when 'nm' then 'mountain'
    when 'ut' then 'mountain'
    when 'wy' then 'mountain'
    when 'ca' then 'pacific'
    when 'nv' then 'pacific'
    when 'or' then 'pacific'
    when 'wa' then 'pacific'
    else null
  end;
end;
$$;

create or replace function public.set_businesses_nowebsite_crm_timezone()
returns trigger
language plpgsql
as $$
begin
  if new.country = 'US' then
    new.crm_timezone := public.crm_timezone_for_us_state(new.state);
  else
    new.crm_timezone := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_businesses_nowebsite_crm_timezone on public.businesses_nowebsite;

create trigger trg_businesses_nowebsite_crm_timezone
  before insert or update of state, country
  on public.businesses_nowebsite
  for each row
  execute function public.set_businesses_nowebsite_crm_timezone();

update public.businesses_nowebsite
set crm_timezone = public.crm_timezone_for_us_state(state)
where country = 'US';
