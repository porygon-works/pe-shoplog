-- お知らせ（アップデート情報など）。管理者が書き、ログインしている全員が読める。
-- 既読はユーザーごとに「最後にお知らせ一覧を開いた時刻」で持つ（端末をまたいでも同じ）。追加的な変更のみ。

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  body text not null default '' check (char_length(body) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_created_at_idx on public.announcements (created_at desc);
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;
create policy announcements_select on public.announcements
  for select to authenticated using (true);
create policy announcements_insert on public.announcements
  for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy announcements_update on public.announcements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy announcements_delete on public.announcements
  for delete to authenticated using (public.is_admin());
revoke all on public.announcements from anon;
grant select, insert, update, delete on public.announcements to authenticated;

create table public.announcement_reads (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now()
);
alter table public.announcement_reads enable row level security;
create policy announcement_reads_own on public.announcement_reads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.announcement_reads from anon;
grant select, insert, update on public.announcement_reads to authenticated;
