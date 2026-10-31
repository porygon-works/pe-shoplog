-- My lists and shared lists.

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('want','favorite')),
  is_public boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_owner_id_idx on public.lists (owner_id);
create unique index lists_default_per_kind_idx
  on public.lists (owner_id, kind) where is_default;
create trigger lists_updated_at before update on public.lists
  for each row execute function public.set_updated_at();

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (list_id, shop_id)
);
create index list_items_list_id_idx on public.list_items (list_id);
create index list_items_shop_id_idx on public.list_items (shop_id);

create table public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  invite_token text not null unique
    default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_lists_owner_id_idx on public.shared_lists (owner_id);
create trigger shared_lists_updated_at before update on public.shared_lists
  for each row execute function public.set_updated_at();

create table public.shared_list_members (
  id uuid primary key default gen_random_uuid(),
  shared_list_id uuid not null references public.shared_lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique (shared_list_id, user_id)
);
create index shared_list_members_user_id_idx on public.shared_list_members (user_id);

create table public.shared_list_items (
  id uuid primary key default gen_random_uuid(),
  shared_list_id uuid not null references public.shared_lists (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  note text,
  added_at timestamptz not null default now(),
  unique (shared_list_id, shop_id)
);
create index shared_list_items_list_idx on public.shared_list_items (shared_list_id);
create index shared_list_items_shop_idx on public.shared_list_items (shop_id);

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so that policies on shared_lists / shared_list_members can
-- consult membership without recursing into each other's RLS.
create function public.is_shared_list_member(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_list_members m
     where m.shared_list_id = p_list and m.user_id = (select auth.uid()));
$$;

create function public.is_shared_list_owner(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_list_members m
     where m.shared_list_id = p_list
       and m.user_id = (select auth.uid())
       and m.role = 'owner');
$$;

create function public.add_shared_list_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shared_list_members (shared_list_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger shared_lists_add_owner after insert on public.shared_lists
  for each row execute function public.add_shared_list_owner_member();

create function public.join_shared_list(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select id into v_list from public.shared_lists where invite_token = p_token;
  if v_list is null then
    raise exception 'invalid_invite';
  end if;
  insert into public.shared_list_members (shared_list_id, user_id, role)
  values (v_list, (select auth.uid()), 'member')
  on conflict (shared_list_id, user_id) do nothing;
  return v_list;
end;
$$;

create function public.regenerate_invite_token(p_list uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if not public.is_shared_list_owner(p_list) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.shared_lists set invite_token = v_token where id = p_list;
  return v_token;
end;
$$;

-- invite_token is not selectable through the table (a public list would
-- otherwise hand its invite link to everyone); members fetch it here.
create function public.get_invite_token(p_list uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_shared_list_member(p_list) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select invite_token into v_token from public.shared_lists where id = p_list;
  return v_token;
end;
$$;

revoke execute on function
  public.is_shared_list_member(uuid), public.is_shared_list_owner(uuid),
  public.join_shared_list(text), public.regenerate_invite_token(uuid),
  public.get_invite_token(uuid), public.add_shared_list_owner_member()
  from public, anon;
grant execute on function
  public.is_shared_list_member(uuid), public.is_shared_list_owner(uuid),
  public.join_shared_list(text), public.regenerate_invite_token(uuid),
  public.get_invite_token(uuid)
  to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.shared_lists enable row level security;
alter table public.shared_list_members enable row level security;
alter table public.shared_list_items enable row level security;

-- lists: public ones for everyone, private ones for the owner only
create policy lists_select on public.lists for select to authenticated
  using (is_public or owner_id = (select auth.uid()));
create policy lists_insert on public.lists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy lists_update on public.lists for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy lists_delete on public.lists for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_default);
revoke update on public.lists from anon, authenticated;
grant update (name, is_public, updated_at) on public.lists to authenticated;

create policy list_items_select on public.list_items for select to authenticated
  using (exists (
    select 1 from public.lists l
     where l.id = list_id
       and (l.is_public or l.owner_id = (select auth.uid()))));
create policy list_items_insert on public.list_items for insert to authenticated
  with check (exists (
    select 1 from public.lists l
     where l.id = list_id and l.owner_id = (select auth.uid())));
create policy list_items_delete on public.list_items for delete to authenticated
  using (exists (
    select 1 from public.lists l
     where l.id = list_id and l.owner_id = (select auth.uid())));
revoke update on public.list_items from anon, authenticated;

-- shared_lists: members, or everyone when public; body edits by the owner
create policy shared_lists_select on public.shared_lists for select to authenticated
  using (is_public or owner_id = (select auth.uid()) or public.is_shared_list_member(id));
create policy shared_lists_insert on public.shared_lists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy shared_lists_update on public.shared_lists for update to authenticated
  using (public.is_shared_list_owner(id))
  with check (public.is_shared_list_owner(id));
create policy shared_lists_delete on public.shared_lists for delete to authenticated
  using (public.is_shared_list_owner(id));
revoke select, update on public.shared_lists from anon, authenticated;
grant select (id, owner_id, name, description, is_public, created_at, updated_at)
  on public.shared_lists to authenticated;
grant update (name, description, is_public, updated_at)
  on public.shared_lists to authenticated;

-- members: joining happens only through join_shared_list()
create policy shared_list_members_select on public.shared_list_members
  for select to authenticated
  using (
    public.is_shared_list_member(shared_list_id)
    or exists (
      select 1 from public.shared_lists sl
       where sl.id = shared_list_id and sl.is_public));
create policy shared_list_members_delete on public.shared_list_members
  for delete to authenticated
  using (
    role = 'member'
    and (user_id = (select auth.uid())
         or public.is_shared_list_owner(shared_list_id)));
revoke insert, update on public.shared_list_members from anon, authenticated;

-- items: members add / edit / remove, readers per list visibility
create policy shared_list_items_select on public.shared_list_items
  for select to authenticated
  using (
    public.is_shared_list_member(shared_list_id)
    or exists (
      select 1 from public.shared_lists sl
       where sl.id = shared_list_id and sl.is_public));
create policy shared_list_items_insert on public.shared_list_items
  for insert to authenticated
  with check (
    public.is_shared_list_member(shared_list_id)
    and added_by = (select auth.uid()));
create policy shared_list_items_update on public.shared_list_items
  for update to authenticated
  using (public.is_shared_list_member(shared_list_id))
  with check (public.is_shared_list_member(shared_list_id));
create policy shared_list_items_delete on public.shared_list_items
  for delete to authenticated
  using (public.is_shared_list_member(shared_list_id));
revoke update on public.shared_list_items from anon, authenticated;
grant update (note) on public.shared_list_items to authenticated;
