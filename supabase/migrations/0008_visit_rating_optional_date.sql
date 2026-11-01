-- 記録に★評価（任意）を追加し、行った日を任意にする。追加的な変更のみ。
-- shop_index は末尾に avg_rating / rating_count を足す。既存列の順序・定義は変えない。
-- 日付なしの記録が「最新」扱いにならないよう、並びは visited_on desc nulls last にする。

alter table public.visits
  add column rating smallint check (rating is null or rating between 1 and 5);
alter table public.visits alter column visited_on drop not null;
-- visits の UPDATE は列単位の GRANT なので、rating も本人が更新できるようにする。
grant update (rating) on public.visits to authenticated;

create or replace view public.shop_index
with (security_invoker = true) as
select
  s.*,
  a.visit_count,
  a.last_visited_on,
  coalesce(a.smoking, 'unknown') as smoking,
  coalesce(pr.price_range, 'unknown') as price_range,
  a.purposes,
  a.max_party_size,
  a.avg_rating,
  a.rating_count
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
