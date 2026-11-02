import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ログインの総当たり対策。直近 15 分の失敗が、同じ ID で 10 回、同じ IP で 30 回を超えたら止める。
 * （社内の同じ回線から複数人がログインしても止まらないよう、IP の上限は大きめ。）
 */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMIT_PER_ID = 10;
export const LOGIN_LIMIT_PER_IP = 30;

export async function isLoginBlocked(
  loginId: string,
  ip: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const [byId, byIp] = await Promise.all([
    admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("login_id", loginId)
      .gte("attempted_at", since),
    admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempted_at", since),
  ]);
  if (byId.error) throw byId.error;
  if (byIp.error) throw byIp.error;
  return (byId.count ?? 0) >= LOGIN_LIMIT_PER_ID || (byIp.count ?? 0) >= LOGIN_LIMIT_PER_IP;
}

export async function recordLoginFailure(
  loginId: string,
  ip: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<void> {
  const { error } = await admin.from("login_attempts").insert({ login_id: loginId, ip });
  if (error) throw error;
}

/** ログインに成功したら、その ID の失敗記録を消す。 */
export async function clearLoginFailures(
  loginId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<void> {
  const { error } = await admin.from("login_attempts").delete().eq("login_id", loginId);
  if (error) throw error;
}
