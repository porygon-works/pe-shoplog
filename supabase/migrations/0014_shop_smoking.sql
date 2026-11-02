-- 喫煙を「行った記録」ごとの項目から「店」の項目に移す。追加的な変更のみ。
-- shops.smoking を足し、今の表示（最新の記録の喫煙）をそのまま店の値として移す。
-- shop_index.smoking は shops.smoking を返す（列の位置・型は変えない）。visits.smoking は残すが、今後は書かない。

alter table public.shops add column smoking text not null default 'unknown'
  check (smoking in ('smoking_ok', 'separated', 'heated_only', 'no_smoking', 'unknown'));

update public.shops s
   set smoking = x.smoking
  from (
    select distinct on (v.shop_id) v.shop_id, v.smoking
      from public.visits v
     where v.deleted_at is null and v.smoking <> 'unknown'
     order by v.shop_id, v.visited_on desc nulls last, v.created_at desc
  ) x
 where x.shop_id = s.id;

grant update (smoking) on public.shops to authenticated;

create or replace view public.shop_index
with (security_invoker = true) as
select
  s.id,
  s.place_id,
  s.name,
  s.lat,
  s.lng,
  s.location_fetched_at,
  s.genre,
  s.styles,
  s.reference_url,
  s.created_by,
  s.created_at,
  s.updated_at,
  s.deleted_at,
  a.visit_count,
  a.last_visited_on,
  s.smoking,
  coalesce(pr.price_range, 'unknown') as price_range,
  a.purposes,
  a.max_party_size,
  a.avg_rating,
  a.rating_count,
  s.time_slots,
  s.genres
from public.shops s
cross join lateral (
  select
    count(*)::int as visit_count,
    max(v.visited_on) as last_visited_on,
    coalesce(
      array_agg(distinct v.purpose) filter (where v.purpose <> 'unknown'),
      '{}'::text[]) as purposes,
    max(v.party_size) as max_party_size,
    round(avg(v.rating), 1) as avg_rating,
    count(v.rating)::int as rating_count
  from public.visits v
  where v.shop_id = s.id and v.deleted_at is null
) a
left join lateral (
  select v.price_range
  from public.visits v
  where v.shop_id = s.id and v.deleted_at is null and v.price_range <> 'unknown'
  group by v.price_range
  order by count(*) desc, max(v.visited_on) desc nulls last, max(v.created_at) desc
  limit 1
) pr on true
where s.deleted_at is null;
