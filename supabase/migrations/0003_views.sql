-- Aggregation views. security_invoker = true: they run with the caller's RLS.

create view public.shop_index
with (security_invoker = true) as
select
  s.*,
  a.visit_count,
  a.last_visited_on,
  coalesce(a.smoking, 'unknown') as smoking,
  coalesce(pr.price_range, 'unknown') as price_range,
  a.purposes,
  a.max_party_size
from public.shops s
cross join lateral (
  select
    count(*)::int as visit_count,
    max(v.visited_on) as last_visited_on,
    (array_agg(v.smoking order by v.visited_on desc, v.created_at desc)
       filter (where v.smoking <> 'unknown'))[1] as smoking,
    coalesce(
      array_agg(distinct v.purpose) filter (where v.purpose <> 'unknown'),
      '{}'::text[]) as purposes,
    max(v.party_size) as max_party_size
  from public.visits v
  where v.shop_id = s.id and v.deleted_at is null
) a
left join lateral (
  select v.price_range
  from public.visits v
  where v.shop_id = s.id and v.deleted_at is null and v.price_range <> 'unknown'
  group by v.price_range
  order by count(*) desc, max(v.visited_on) desc, max(v.created_at) desc
  limit 1
) pr on true
where s.deleted_at is null;

create view public.public_lists
with (security_invoker = true) as
select
  'personal'::text as kind,
  l.id,
  l.name,
  l.kind as list_kind,
  l.owner_id,
  p.nickname as owner_nickname,
  (select count(*)::int
     from public.list_items li
     join public.shops s on s.id = li.shop_id and s.deleted_at is null
    where li.list_id = l.id) as shop_count,
  greatest(
    l.updated_at,
    (select max(li.added_at) from public.list_items li where li.list_id = l.id)
  ) as updated_at
from public.lists l
join public.profiles p on p.id = l.owner_id
where l.is_public
union all
select
  'shared'::text,
  sl.id,
  sl.name,
  null::text,
  sl.owner_id,
  p.nickname,
  (select count(*)::int
     from public.shared_list_items si
     join public.shops s on s.id = si.shop_id and s.deleted_at is null
    where si.shared_list_id = sl.id),
  greatest(
    sl.updated_at,
    (select max(si.added_at) from public.shared_list_items si
      where si.shared_list_id = sl.id)
  )
from public.shared_lists sl
join public.profiles p on p.id = sl.owner_id
where sl.is_public;

revoke all on public.shop_index, public.public_lists from anon;
grant select on public.shop_index, public.public_lists to authenticated;
