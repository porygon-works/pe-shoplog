import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH_EMAIL_DOMAIN, toAuthEmail } from "@/lib/auth/login-id";
import { loadSupabaseEnv } from "./env";

const env = loadSupabaseEnv();
export { AUTH_EMAIL_DOMAIN };
const PASSWORD = "test-password-1234";

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

export function adminClient(): SupabaseClient {
  return createClient(env.url, env.secretKey, clientOptions);
}

/** ログインしていないクライアント（publishable キーのみ）。 */
export function anonClient(): SupabaseClient {
  return createClient(env.url, env.publishableKey, clientOptions);
}

export function uniqueId(prefix = "u"): string {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/** 管理操作で auth ユーザー + profile を作り、ログイン済みクライアントを返す。 */
export async function createTestUser(
  loginId: string,
  opts: { admin?: boolean } = {},
): Promise<{ id: string; client: SupabaseClient }> {
  const admin = adminClient();
  const email = toAuthEmail(loginId);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const id = data.user.id;

  const profile = await admin.from("profiles").insert({
    id,
    login_id: loginId,
    nickname: loginId,
    is_admin: opts.admin ?? false,
  });
  if (profile.error) throw profile.error;

  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signIn.error) throw signIn.error;
  return { id, client };
}

/** secret キーで店を 1 件作る（テスト用フィクスチャ）。 */
export async function createShop(
  createdBy: string | null,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await adminClient()
    .from("shops")
    .insert({
      name: `shop-${uniqueId()}`,
      lat: 35.68,
      lng: 139.76,
      created_by: createdBy,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** secret キーで visit を 1 件作る。 */
export async function createVisit(
  shopId: string,
  userId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await adminClient()
    .from("visits")
    .insert({
      shop_id: shopId,
      user_id: userId,
      visited_on: "2026-01-01",
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
