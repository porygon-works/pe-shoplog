import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/** 操作ログを残す日数。これより古いものは書き込みのついでに消す。 */
export const LOG_RETENTION_DAYS = 30;
// 書き込み 50 回に 1 回くらい、古いログを消す。
const PURGE_RATE = 1 / 50;
const MAX_STRING = 200;

export type LogEntry = {
  action: string;
  level?: "info" | "error";
  source?: "server" | "client";
  userId?: string | null;
  path?: string | null;
  /** id・件数・エラーの種類など。コメント本文やパスワードは入れない。 */
  detail?: Record<string, unknown>;
  userAgent?: string | null;
};

/** 文字列を短くし、入れ子は 1 段までにする（ログが大きくなりすぎないように）。 */
export function sanitizeDetail(detail: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail).slice(0, 20)) {
    if (v === null || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, MAX_STRING);
    else if (v instanceof Error) out[k] = `${v.name}: ${v.message}`.slice(0, MAX_STRING);
    else if (v !== undefined) {
      try {
        out[k] = JSON.stringify(v).slice(0, MAX_STRING);
      } catch {
        out[k] = String(v).slice(0, MAX_STRING);
      }
    }
  }
  return out;
}

/** 例外から、ログに残せる短い説明（コード・メッセージ）を取り出す。 */
export function errorInfo(e: unknown): Record<string, unknown> {
  if (e && typeof e === "object") {
    const o = e as { code?: unknown; message?: unknown; name?: unknown };
    return {
      code: typeof o.code === "string" ? o.code : null,
      message: typeof o.message === "string" ? o.message.slice(0, MAX_STRING) : String(e).slice(0, MAX_STRING),
    };
  }
  return { message: String(e).slice(0, MAX_STRING) };
}

async function write(entry: LogEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("app_logs").insert({
      user_id: entry.userId ?? null,
      level: entry.level ?? "info",
      source: entry.source ?? "server",
      action: entry.action.slice(0, 60),
      path: entry.path ? entry.path.slice(0, 300) : null,
      detail: sanitizeDetail(entry.detail),
      user_agent: entry.userAgent ? entry.userAgent.slice(0, 300) : null,
    });
    if (error) console.error("app_logs insert failed", error);
    if (Math.random() < PURGE_RATE) {
      const before = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error: purgeError } = await admin.from("app_logs").delete().lt("created_at", before);
      if (purgeError) console.error("app_logs purge failed", purgeError);
    }
  } catch (e) {
    // ログの失敗で本来の操作を失敗させない。
    console.error("app_logs write failed", e);
  }
}

/**
 * 操作ログを残す（Server Action・Route Handler から呼ぶ）。応答を返したあとに書き込むので、操作は遅くならない。
 * 失敗しても例外は投げない。
 */
export function logEvent(entry: LogEntry): void {
  try {
    after(async () => {
      let userAgent = entry.userAgent ?? null;
      if (userAgent === null) {
        try {
          userAgent = (await headers()).get("user-agent");
        } catch {
          userAgent = null;
        }
      }
      // userId を渡さなければ、ログイン中のユーザーを入れる。
      let userId = entry.userId;
      if (userId === undefined) {
        try {
          const { data } = await (await createServerClient()).auth.getClaims();
          userId = (data?.claims?.sub as string | undefined) ?? null;
        } catch {
          userId = null;
        }
      }
      await write({ ...entry, userAgent, userId });
    });
  } catch (e) {
    console.error("logEvent failed", e);
  }
}

/**
 * Server Action の結果をそのままログにする。{ error } なら error、それ以外は info。
 * detail には id などだけを入れる。
 */
export function logResult<T>(action: string, result: T, detail: Record<string, unknown> = {}): T {
  const err = result && typeof result === "object" && "error" in result ? (result as { error: unknown }).error : null;
  logEvent({
    action,
    level: err ? "error" : "info",
    detail: err ? { ...detail, error: String(err) } : detail,
  });
  return result;
}
