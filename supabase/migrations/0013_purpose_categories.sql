-- 用途もジャンル・形態と同じく shop_categories（kind = 'purpose'）で管理し、だれでも追加できるようにする。
-- 既存の値（0012 の選択肢）をそのまま種データにする。「不明」(unknown) は行を作らず、未選択を表す値として残す。
-- visits の CHECK 制約はトリガーでの存在確認に置き換える。データは変更しない。

alter table public.shop_categories drop constraint shop_categories_kind_check;
alter table public.shop_categories add constraint shop_categories_kind_check
  check (kind in ('genre', 'style', 'purpose'));

insert into public.shop_categories (kind, value, label, sort_order) values
  ('purpose', 'training_2', '養成講座２部', 10),
  ('purpose', 'mentor', 'メンター面談', 20),
  ('purpose', 'team_meeting', 'チーム会議後', 30),
  ('purpose', 'after_work', 'しごおわ', 40),
  ('purpose', 'all_night', '朝まで', 50),
  ('purpose', 'all_hands', '社員総会後', 60),
  ('purpose', 'celebration', '打ち上げ', 70),
  ('purpose', 'welcome_farewell', '歓送迎会', 80),
  ('purpose', 'peers_only', '同期飲み', 90),
  ('purpose', 'entertainment', '接待', 100),
  ('purpose', 'other', 'その他', 110)
on conflict do nothing;

alter table public.visits drop constraint visits_purpose_check;

create function public.visits_validate_purpose()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.purpose <> 'unknown' and not exists (
    select 1 from public.shop_categories c where c.kind = 'purpose' and c.value = new.purpose
  ) then
    raise exception 'invalid purpose: %', new.purpose using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.visits_validate_purpose() from public, anon, authenticated;

create trigger visits_validate_purpose before insert or update of purpose on public.visits
  for each row execute function public.visits_validate_purpose();
