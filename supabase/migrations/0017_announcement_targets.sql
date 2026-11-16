-- お知らせを特定の人だけに出せるようにする（確認用に「自分だけ」に出してから全員に出す、など）。追加的な変更のみ。
-- target_user_ids: null = 全員。配列ならその人たちだけが読める。
-- published_at: 全員（または今の対象）に出した時刻。未読はこの時刻で数える（あとから全員に出したときも未読になるように）。

alter table public.announcements add column target_user_ids uuid[];
alter table public.announcements add column published_at timestamptz not null default now();
update public.announcements set published_at = created_at;
create index announcements_published_at_idx on public.announcements (published_at desc);

drop policy announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (target_user_ids is null or auth.uid() = any (target_user_ids) or public.is_admin());
