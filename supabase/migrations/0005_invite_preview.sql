-- Preview of a shared list for someone holding an invite link. Non-members
-- cannot read private shared_lists through RLS, so the invite page asks here.
-- The token itself is never returned.

create function public.get_invite_preview(p_token text)
returns table (
  id uuid,
  name text,
  description text,
  owner_nickname text,
  member_count bigint,
  shop_count bigint,
  is_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sl.id,
    sl.name,
    sl.description,
    p.nickname,
    (select count(*) from public.shared_list_members m where m.shared_list_id = sl.id),
    (select count(*)
       from public.shared_list_items i
       join public.shops s on s.id = i.shop_id and s.deleted_at is null
      where i.shared_list_id = sl.id),
    exists (
      select 1 from public.shared_list_members m
       where m.shared_list_id = sl.id and m.user_id = (select auth.uid()))
  from public.shared_lists sl
  left join public.profiles p on p.id = sl.owner_id
  where sl.invite_token = p_token
    and (select auth.uid()) is not null;
$$;

revoke execute on function public.get_invite_preview(text) from public, anon;
grant execute on function public.get_invite_preview(text) to authenticated;
