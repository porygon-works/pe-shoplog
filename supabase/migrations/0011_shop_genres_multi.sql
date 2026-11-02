-- ジャンルを複数選べるようにする。追加的な変更のみ。
-- 新しい列 genres（text[]、空 = 未設定）を足し、既存の genre から移す。genre 列は残し、
-- これまでとの互換のため genres の先頭（空なら 'unknown'）をトリガーで入れ続ける。
-- 「不明」(unknown) は genres には入れない（何も選ばないことで表す）。

alter table public.shops add column genres text[] not null default '{}';
update public.shops set genres = array[genre] where genre <> 'unknown';
grant update (genres) on public.shops to authenticated;

create or replace function public.shops_validate_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- genre だけを書く古い書き込み（移行中の旧アプリ）は genres に反映する。
  if tg_op = 'INSERT' then
    if cardinality(new.genres) = 0 and new.genre <> 'unknown' then
      new.genres := array[new.genre];
    end if;
  elsif new.genre is distinct from old.genre and new.genres is not distinct from old.genres then
    new.genres := case when new.genre = 'unknown' then '{}'::text[] else array[new.genre] end;
  end if;
  if 'unknown' = any(new.genres) or cardinality(new.genres) > 50 then
    raise exception 'invalid genres: %', new.genres using errcode = '23514';
  end if;
  if exists (
    select 1
      from unnest(new.genres) as g(value)
     where not exists (
       select 1 from public.shop_categories c where c.kind = 'genre' and c.value = g.value
     )
  ) then
    raise exception 'invalid genres: %', new.genres using errcode = '23514';
  end if;
  -- 互換用の genre 列は genres の先頭にそろえる。
  new.genre := coalesce(new.genres[1], 'unknown');
  if exists (
    select 1
      from unnest(new.styles) as s(value)
     where not exists (
       select 1 from public.shop_categories c where c.kind = 'style' and c.value = s.value
     )
  ) then
    raise exception 'invalid styles: %', new.styles using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.shops_validate_categories() from public, anon, authenticated;

drop trigger shops_validate_categories on public.shops;
create trigger shops_validate_categories before insert or update of genre, genres, styles on public.shops
  for each row execute function public.shops_validate_categories();

-- shop_index の末尾に genres を足す（既存列の順序は 0009 のまま）。
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
  s.time_slots,
  s.genres
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
