-- セキュリティ強化と、従量課金の API の使用回数の上限。追加的な変更のみ。

-- ---------------------------------------------------------------- ログインの試行回数
-- ログインは Server Action から行うので、Supabase Auth の IP 制限は Vercel のサーバー全体に 1 つかかるだけ。
-- ID ごと・IP ごとの失敗回数をここに記録し、総当たりを止める。secret キーでのみ操作する。
create table public.login_attempts (
  id bigint generated always as identity primary key,
  login_id text not null,
  ip text not null,
  attempted_at timestamptz not null default now()
);
create index login_attempts_login_id_idx on public.login_attempts (login_id, attempted_at);
create index login_attempts_ip_idx on public.login_attempts (ip, attempted_at);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- ---------------------------------------------------------------- 従量課金の API の使用回数
-- Google Places（検索候補・店の詳細・写真・公式サイト）を呼ぶたびに数える。
-- 1 人ごとの 1 日（日本時間）の上限と、全員合計の 1 か月の上限（Google の無料枠に収まる値）を超えたら呼ばない。
-- secret キーでのみ操作する。
create table public.api_usage (
  day date not null,
  user_id uuid not null,
  kind text not null,
  count int not null default 0,
  primary key (day, user_id, kind)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

-- 1 回分を数え、上限内なら true。数えてから判定するので、同時に呼ばれても上限を大きく超えない。
create function public.api_usage_hit(p_user uuid, p_kind text, p_user_daily_limit int, p_global_monthly_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := (now() at time zone 'Asia/Tokyo')::date;
  u int;
  g int;
begin
  insert into public.api_usage (day, user_id, kind, count) values (d, p_user, p_kind, 1)
  on conflict (day, user_id, kind) do update set count = public.api_usage.count + 1
  returning count into u;
  select coalesce(sum(count), 0) into g
    from public.api_usage
   where day >= date_trunc('month', d)::date and kind = p_kind;
  return u <= p_user_daily_limit and g <= p_global_monthly_limit;
end;
$$;
revoke execute on function public.api_usage_hit(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.api_usage_hit(uuid, text, int, int) to service_role;

-- ---------------------------------------------------------------- 関数の実行権限
-- トリガー用の関数は API から直接呼べる必要がない（トリガーとしては権限なしでも動く）。
revoke execute on function public.shops_validate_categories() from public, anon, authenticated;
revoke execute on function public.add_shared_list_owner_member() from public, anon, authenticated;
