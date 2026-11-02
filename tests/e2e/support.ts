import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { hashPassphrase } from "../../src/lib/auth/passphrase";
import { loadSupabaseEnv } from "../db/env";

export const PASSPHRASE = "pe";
export const PASSWORD = "e2e-password-1234";

export function uniqueLoginId(prefix = "e2e"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

/** 合言葉を既知の値にし、IP ごとの試行制限を空にする（e2e を繰り返し実行できるように）。 */
export async function prepareSignup(): Promise<void> {
  const env = loadSupabaseEnv();
  const host = new URL(env.url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `prepareSignup は signup_attempts を全削除し合言葉を上書きするため、ローカルの Supabase でのみ実行できます（現在の接続先: ${host}）`,
    );
  }
  const admin = createClient(env.url, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const up = await admin.from("app_settings").upsert({
    key: "signup_passphrase_hash",
    value: await hashPassphrase(PASSPHRASE),
  });
  if (up.error) throw up.error;
  const del = await admin
    .from("signup_attempts")
    .delete()
    .gte("attempted_at", "1970-01-01");
  if (del.error) throw del.error;
  // ログインの失敗記録も消す（e2e は同じ IP からログインを失敗させるテストを含むため）。
  const delLogin = await admin.from("login_attempts").delete().gte("attempted_at", "1970-01-01");
  if (delLogin.error) throw delLogin.error;
}
