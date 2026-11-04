-- 操作ログ。「記録したのに残っていない」などの問い合わせを後から調べるため、
-- 主な操作（店・記録・写真・区分）の成功と失敗、画面（スマホ側）で起きたエラーを残す。
-- コメント本文やパスワードは残さない。30 日を過ぎたものは消す（アプリが書き込むときに古いものを消す）。
-- 書き込みは secret キー（サーバー）だけ。読めるのは管理者だけ。

create table public.app_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  level text not null check (level in ('info', 'error')),
  source text not null check (source in ('server', 'client')),
  action text not null check (char_length(action) between 1 and 60),
  path text check (path is null or char_length(path) <= 300),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 4000),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300)
);
create index app_logs_created_at_idx on public.app_logs (created_at desc);
create index app_logs_user_idx on public.app_logs (user_id, created_at desc);

alter table public.app_logs enable row level security;
revoke all on public.app_logs from anon, authenticated;
grant select on public.app_logs to authenticated;
create policy app_logs_select_admin on public.app_logs
  for select to authenticated using (public.is_admin());
