-- Core tables: profiles, shops, visits, photos, app_settings, signup_attempts.
-- Option values mirror src/lib/options.ts (single source of truth).

create extension if not exists pgcrypto with schema extensions;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  login_id text not null unique,
  nickname text not null check (char_length(nickname) between 1 and 20),
  is_admin boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- shops
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  location_fetched_at timestamptz,
  genre text not null default 'unknown' check (genre in (
    'washoku','sushi_seafood','yakiniku','yakitori','nabe','chinese','korean',
    'asian_ethnic','italian','french_bistro','yoshoku','ramen','curry','cafe',
    'other','unknown')),
  styles text[] not null default '{}' check (styles <@ array[
    'taishu_izakaya','izakaya','dining_bar','bar','tachinomi','private_room',
    'karaoke','other']::text[]),
  reference_url text check (reference_url is null or reference_url = '' or reference_url ~ '^https?://'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index shops_created_by_idx on public.shops (created_by);
create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- visits
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  visited_on date not null,
  smoking text not null default 'unknown' check (smoking in (
    'smoking_ok','separated','heated_only','no_smoking','unknown')),
  price_range text not null default 'unknown' check (price_range in (
    'under_3000','3000_4999','5000_6999','7000_9999','over_10000','unknown')),
  purpose text not null default 'unknown' check (purpose in (
    'team_meeting','all_hands','celebration','welcome_farewell','peers_only',
    'entertainment','private','other','unknown')),
  party_size integer check (party_size is null or party_size > 0),
  reservation text not null default 'unknown' check (reservation in (
    'reserved','walk_in','unknown')),
  payment_methods text[] not null default '{}' check (payment_methods <@ array[
    'credit_card','qr','transit_ic','cash_only']::text[]),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index visits_shop_id_idx on public.visits (shop_id);
create index visits_user_id_idx on public.visits (user_id);
create trigger visits_updated_at before update on public.visits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'other' check (kind in (
    'menu','seat','food','exterior','other')),
  storage_path text not null unique,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index photos_visit_id_idx on public.photos (visit_id);
create index photos_shop_id_idx on public.photos (shop_id);
create index photos_user_id_idx on public.photos (user_id);
create trigger photos_updated_at before update on public.photos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- server-only
create table public.app_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

create table public.signup_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  attempted_at timestamptz not null default now()
);
create index signup_attempts_ip_idx on public.signup_attempts (ip, attempted_at);

-- ---------------------------------------------------------------- helpers
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin and p.disabled_at is null
       from public.profiles p
      where p.id = (select auth.uid())),
    false);
$$;

create function public.soft_delete_shop(p_shop uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.shops set deleted_at = now()
   where id = p_shop and deleted_at is null;
end;
$$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.visits enable row level security;
alter table public.photos enable row level security;
alter table public.app_settings enable row level security;
alter table public.signup_attempts enable row level security;

-- app_settings / signup_attempts: no policies = nobody but the secret key.
revoke all on public.app_settings, public.signup_attempts from anon, authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nickname, updated_at) on public.profiles to authenticated;

-- shops
create policy shops_select on public.shops for select to authenticated
  using (deleted_at is null);
create policy shops_insert on public.shops for insert to authenticated
  with check (created_by = (select auth.uid()) and deleted_at is null);
create policy shops_update on public.shops for update to authenticated
  using (deleted_at is null)
  with check (deleted_at is null);
revoke update, delete on public.shops from anon, authenticated;
grant update (name, genre, styles, reference_url, updated_at) on public.shops to authenticated;

-- visits (own soft-deleted rows stay visible so that UPDATE ... RETURNING works)
create policy visits_select on public.visits for select to authenticated
  using (deleted_at is null or user_id = (select auth.uid()) or public.is_admin());
create policy visits_insert on public.visits for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy visits_update on public.visits for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
-- No hard delete: soft delete via deleted_at only.
revoke delete on public.visits from anon, authenticated;
revoke update on public.visits from anon, authenticated;
grant update (visited_on, smoking, price_range, purpose, party_size,
  reservation, payment_methods, comment, deleted_at, updated_at)
  on public.visits to authenticated;

-- photos (may only be attached to one's own visit)
create policy photos_select on public.photos for select to authenticated
  using (deleted_at is null or user_id = (select auth.uid()) or public.is_admin());
create policy photos_insert on public.photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.visits v
       where v.id = visit_id and v.user_id = (select auth.uid()))
  );
create policy photos_update on public.photos for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
revoke delete on public.photos from anon, authenticated;
revoke update on public.photos from anon, authenticated;
grant update (kind, deleted_at, updated_at) on public.photos to authenticated;

-- functions: callable by signed-in users only
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.soft_delete_shop(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.soft_delete_shop(uuid) to authenticated;
