import Link from "next/link";
import { BackButton } from "@/components/back-link";
import { requireAdmin } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "操作ログ" };

const LIMIT = 300;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOGIN_RE = /^[a-z0-9._-]{1,40}$/;

const ACTION_LABELS: Record<string, string> = {
  shop_create: "店の登録",
  shop_update: "店情報の編集",
  shop_delete: "店の削除",
  visit_create: "記録の保存",
  visit_update: "記録の編集",
  visit_delete: "記録の削除",
  photo_add: "写真の追加",
  photo_delete: "写真の削除",
  category_add: "区分の追加",
  visit_save_failed: "記録の保存（送信できず）",
  photo_upload_failed: "写真の送信失敗",
  photo_resize_failed: "写真の読み込み失敗",
  client_error: "画面のエラー",
  client_rejection: "画面のエラー",
};

type LogRow = {
  id: number;
  created_at: string;
  level: string;
  source: string;
  action: string;
  path: string | null;
  detail: Record<string, unknown>;
  user_agent: string | null;
  profiles: { login_id: string; nickname: string } | null;
};

function jst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function device(ua: string | null): string {
  if (!ua) return "";
  if (/iPhone|iPad/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Windows|Macintosh|Linux/.test(ua)) return "PC";
  return "";
}

/** 管理者だけが見られる、直近 30 日の操作ログ。人・日付・エラーだけで絞り込める。 */
export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; date?: string; errors?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const user = sp.user && LOGIN_RE.test(sp.user) ? sp.user : "";
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : "";
  const errorsOnly = sp.errors === "1";

  const supabase = await createServerClient();
  let userId: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("id").eq("login_id", user).maybeSingle();
    userId = (data?.id as string | undefined) ?? "00000000-0000-0000-0000-000000000000";
  }

  let q = supabase
    .from("app_logs")
    .select("id, created_at, level, source, action, path, detail, user_agent, profiles(login_id, nickname)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (userId) q = q.eq("user_id", userId);
  if (errorsOnly) q = q.eq("level", "error");
  if (date) {
    // 日本時間のその日
    q = q.gte("created_at", `${date}T00:00:00+09:00`).lt("created_at", `${date}T23:59:59.999+09:00`);
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as LogRow[];

  return (
    <main className="flex flex-1 flex-col gap-3 p-4 pb-24">
      <BackButton />
      <h1 className="m-0 text-lg font-bold">操作ログ</h1>
      <p className="m-0 text-xs text-muted">
        店・記録・写真・区分の操作と、画面で起きたエラーを 30 日分残しています（コメント本文などは残しません）。新しい順に最大 {LIMIT} 件。
      </p>

      <form className="grid grid-cols-2 gap-2" action="/admin/logs">
        <input name="user" defaultValue={user} placeholder="ログインID" aria-label="ログインID" className="input" />
        <input name="date" type="date" defaultValue={date} aria-label="日付" className="input" />
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="errors" value="1" defaultChecked={errorsOnly} />
          エラーだけ
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1 !py-2 text-[13px]">
            絞り込む
          </button>
          <Link href="/admin/logs" className="btn !py-2 text-[13px]">
            解除
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-muted">該当するログはありません</p>
      ) : (
        <ul data-testid="app-logs" className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => {
            const shopId = typeof r.detail.shopId === "string" ? r.detail.shopId : null;
            const rest = Object.entries(r.detail).filter(([k]) => k !== "shopId");
            return (
              <li
                key={r.id}
                className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-[13px] ${
                  r.level === "error" ? "border-shu bg-shu-soft" : "border-line bg-surface"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span className="tabular-nums">{jst(r.created_at)}</span>
                  <span>{r.profiles ? `${r.profiles.nickname}（${r.profiles.login_id}）` : "不明なユーザー"}</span>
                  <span>{device(r.user_agent)}</span>
                  {r.source === "client" && <span>画面から</span>}
                </div>
                <div className="font-bold">
                  {r.level === "error" && <span className="text-shu">失敗 </span>}
                  {ACTION_LABELS[r.action] ?? r.action}
                  {shopId && (
                    <>
                      {" "}
                      <Link href={`/shops/${shopId}`} className="text-xs font-normal text-ai">
                        店を開く
                      </Link>
                    </>
                  )}
                </div>
                {rest.length > 0 && (
                  <div className="break-all text-[11px] text-muted">
                    {rest.map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" / ")}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
