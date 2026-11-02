"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeLoginId, toAuthEmail } from "@/lib/auth/login-id";
import { safeNextPath } from "@/lib/auth/next-path";
import { createServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; loginId?: string };

const SERVER_ERROR = "ログインに失敗しました。時間をおいてもう一度お試しください";
const LOGIN_FAILED = "IDかパスワードが違います";
const RATE_LIMITED = "ログインが混み合っています。少し待ってからもう一度お試しください";

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
      if (error.status === 429 || error.code === "over_request_rate_limit") {
        return { error: RATE_LIMITED, loginId };
      }
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

  // 画面の一時保存（staleTimes）を破棄して、地図や一覧に最新の状態を出す。
  revalidatePath("/", "layout");
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  // 画面の一時保存（staleTimes）を破棄して、地図や一覧に最新の状態を出す。
  revalidatePath("/", "layout");
  redirect("/login");
}
