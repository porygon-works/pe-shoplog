-- 店に時間帯区分（昼 lunch / 夜 dinner、複数可）を追加する。追加的な変更のみ。
-- 既存の店はすべて「夜」。shop_index は s.* をやめて列を明示し、末尾に time_slots を足す
-- （create or replace view では既存列の順序を変えられないため。順序は 0008 時点のもの）。

alter table public.shops
  add column time_slots text[] not null default '{dinner}'
  check (time_slots <@ array['lunch', 'dinner']::text[] and cardinality(time_slots) >= 1);
-- 既存行は default で {dinner} になるが、念のため明示する。
update public.shops set time_slots = '{dinner}' where time_slots <> '{dinner}';
-- shops の UPDATE は列単位の GRANT なので、time_slots も更新できるようにする。
grant update (time_slots) on public.shops to authenticated;

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
  coalesce(a.smoking, 'unknown') as smoking,
  coalesce(pr.price_range, 'unknown') as price_range,
  a.purposes,
  a.max_party_size,
  a.avg_rating,
  a.rating_count,
  s.time_slots
from public.shops s
cross join lateral (
  select
    count(*)::int as visit_count,
    max(v.visited_on) as last_visited_on,
    (array_agg(v.smoking order by v.visited_on desc nulls last, v.created_at desc)
       filter (where v.smoking <> 'unknown'))[1] as smoking,
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
