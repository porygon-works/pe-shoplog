import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupInputSchema, type SignupInput } from "@/lib/validation";
import { toAuthEmail } from "./login-id";
import { verifyPassphrase } from "./passphrase";

export type RegisterError =
  | "rate_limited"
  | "bad_passphrase"
  | "login_id_taken"
  | "invalid";

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: RegisterError };

export const PASSPHRASE_SETTING_KEY = "signup_passphrase_hash";
export const SIGNUP_ATTEMPT_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * 新規登録の本体。IP の取得など Next 固有の処理は呼び出し側（Server Action）で行う。
 * admin は RLS を迂回する secret キーのクライアント。
 */
export async function registerUser(
  input: SignupInput,
  ip: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<RegisterResult> {
  const parsed = signupInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { loginId, nickname, password, passphrase } = parsed.data;

  // 1. 試行を記録し、直近 1 時間の件数を確認する（今回分を含む）。
  const recorded = await admin.from("signup_attempts").insert({ ip });
  if (recorded.error) throw recorded.error;
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const counted = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("attempted_at", since);
  if (counted.error) throw counted.error;
  if ((counted.count ?? 0) > SIGNUP_ATTEMPT_LIMIT) {
    return { ok: false, error: "rate_limited" };
  }

  // 2. 合言葉の照合。
  const setting = await admin
    .from("app_settings")
    .select("value")
    .eq("key", PASSPHRASE_SETTING_KEY)
    .maybeSingle();
  if (setting.error) throw setting.error;
  if (!setting.data || !(await verifyPassphrase(passphrase, setting.data.value))) {
    return { ok: false, error: "bad_passphrase" };
  }

  // 3. auth ユーザー。メール重複 = ID 重複。
  const created = await admin.auth.admin.createUser({
    email: toAuthEmail(loginId),
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    const e = created.error;
    if (e && (e.code === "email_exists" || e.status === 422)) {
      return { ok: false, error: "login_id_taken" };
    }
    throw e ?? new Error("createUser failed");
  }
  const userId = created.data.user.id;

  // 4. profiles と既定リスト。失敗したら auth ユーザーを消す（profiles/lists は cascade）。
  const profile = await admin
    .from("profiles")
    .insert({ id: userId, login_id: loginId, nickname });
  const lists = profile.error
    ? null
    : await admin.from("lists").insert([
        { owner_id: userId, name: "気になる", kind: "want", is_public: false, is_default: true },
        { owner_id: userId, name: "お気に入り", kind: "favorite", is_public: false, is_default: true },
      ]);
  if (profile.error || lists?.error) {
    await admin.auth.admin.deleteUser(userId);
    if (profile.error?.code === "23505") {
      return { ok: false, error: "login_id_taken" };
    }
    throw profile.error ?? lists?.error;
  }

  return { ok: true, userId };
}
