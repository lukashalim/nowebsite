-- Applied via Supabase MCP migration create_profiles_subscription (project hihupmzzlgxotxwcknjh).
-- Per-user subscription state for Stripe Pro tier.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_pro boolean not null default false,
  stripe_customer_id text,
  subscription_price text,
  subscription_started_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing auth users (run once after migration):
-- insert into public.profiles (id, email)
-- select id, email from auth.users
-- on conflict (id) do nothing;
