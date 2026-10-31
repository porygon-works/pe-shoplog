"use server";

import { redirect } from "next/navigation";
import { normalizeLoginId, toAuthEmail } from "@/lib/auth/login-id";
import { safeNextPath } from "@/lib/auth/next-path";
import { createServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; loginId?: string };

const SERVER_ERROR = "ログインに失敗しました。時間をおいてもう一度お試しください";
const LOGIN_FAILED = "IDかパスワードが違います";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const loginId = normalizeLoginId(String(formData.get("loginId") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "") || null);

  if (!loginId || !password) return { error: LOGIN_FAILED, loginId };

  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toAuthEmail(loginId),
      password,
    });
    if (error) {
      // 認証情報の誤り・停止中ユーザーなどの 4xx は「IDかパスワードが違います」。
      // 5xx・通信エラーは想定外として記録し、別のメッセージを出す。
      const unexpected =
        error.name === "AuthRetryableFetchError" ||
        !error.status ||
        error.status >= 500;
      if (!unexpected) return { error: LOGIN_FAILED, loginId };
      console.error("login failed unexpectedly", error);
      return { error: SERVER_ERROR, loginId };
    }
  } catch (e) {
    console.error("login failed unexpectedly", e);
    return { error: SERVER_ERROR, loginId };
  }

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
