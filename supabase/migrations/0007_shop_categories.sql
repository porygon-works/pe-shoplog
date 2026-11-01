-- 区分（ジャンル・形態）を管理画面から編集できるようにする。
-- value は不変の ID、label は編集可。削除はせず hidden で新規の選択肢から外す。
-- 追加的な変更のみ（既存の列・データは変更しない）。shops の CHECK 制約はトリガー検証に置き換える。

create table public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('genre', 'style')),
  value text not null check (value ~ '^[a-z0-9_]{1,40}$'),
  label text not null check (char_length(btrim(label)) between 1 and 20),
  sort_order int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, value),
  -- 「不明」は未選択時の既定値なので隠せない。
  check (not (kind = 'genre' and value = 'unknown' and hidden))
);
create trigger shop_categories_updated_at before update on public.shop_categories
  for each row execute function public.set_updated_at();

-- 種データ: これまでの GENRES / STYLES と同じ value・label・並び順。
insert into public.shop_categories (kind, value, label, sort_order) values
  ('genre', 'washoku', '和食', 10),
  ('genre', 'sushi_seafood', '寿司・海鮮', 20),
  ('genre', 'yakiniku', '焼肉・ホルモン', 30),
  ('genre', 'yakitori', '焼き鳥・串', 40),
  ('genre', 'nabe', '鍋', 50),
  ('genre', 'chinese', '中華', 60),
  ('genre', 'korean', '韓国', 70),
  ('genre', 'asian_ethnic', 'アジア・エスニック', 80),
  ('genre', 'italian', 'イタリアン', 90),
  ('genre', 'french_bistro', 'フレンチ・ビストロ', 100),
  ('genre', 'yoshoku', '洋食', 110),
  ('genre', 'ramen', 'ラーメン', 120),
  ('genre', 'curry', 'カレー', 130),
  ('genre', 'cafe', 'カフェ', 140),
  ('genre', 'other', 'その他', 150),
  ('genre', 'unknown', '不明', 160),
  ('style', 'taishu_izakaya', '大衆居酒屋', 10),
  ('style', 'izakaya', '居酒屋', 20),
  ('style', 'dining_bar', 'ダイニングバー', 30),
  ('style', 'bar', 'バー', 40),
  ('style', 'tachinomi', '立ち飲み', 50),
  ('style', 'private_room', '個室あり', 60),
  ('style', 'karaoke', 'カラオケ', 70),
  ('style', 'other', 'その他', 80)
on conflict do nothing;

alter table public.shop_categories enable row level security;
create policy shop_categories_select on public.shop_categories
  for select to authenticated using (true);
create policy shop_categories_insert on public.shop_categories
  for insert to authenticated with check (public.is_admin());
create policy shop_categories_update on public.shop_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- delete のポリシーは作らない（既存の店が参照しているため削除不可）。
grant select, insert, update on public.shop_categories to authenticated;

-- shops の CHECK 制約（0001 で名前なしに作られたもの）を外し、トリガーで存在を検証する。
-- 非表示でも存在すれば可（既存の店の値を保てるように）。
alter table public.shops drop constraint if exists shops_genre_check;
alter table public.shops drop constraint if exists shops_styles_check;

create function public.shops_validate_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.shop_categories c where c.kind = 'genre' and c.value = new.genre
  ) then
    raise exception 'invalid genre: %', new.genre using errcode = '23514';
  end if;
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

create trigger shops_validate_categories before insert or update of genre, styles on public.shops
  for each row execute function public.shops_validate_categories();
