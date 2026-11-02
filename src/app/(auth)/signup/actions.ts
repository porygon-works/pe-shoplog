"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAuthEmail } from "@/lib/auth/login-id";
import { safeNextPath } from "@/lib/auth/next-path";
import { registerUser, type RegisterError } from "@/lib/auth/signup";
import { createServerClient } from "@/lib/supabase/server";
import { signupInputSchema } from "@/lib/validation";

export type SignupState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"loginId" | "nickname" | "password" | "passphrase", string>
  >;
  values?: { loginId: string; nickname: string };
};

const FIELD_MESSAGES = {
  loginId: "ユーザーIDは半角英小文字・数字・記号（. _ -）で3〜20文字です（最初と最後は英数字）",
  nickname: "ニックネームは1〜20文字です",
  password: "パスワードは8文字以上です",
  passphrase: "合言葉を入れてください",
} as const;

const ERROR_MESSAGES: Record<RegisterError, string> = {
  rate_limited: "試行回数が多すぎます。しばらくしてからお試しください",
  bad_passphrase: "合言葉が違います",
  login_id_taken: "そのIDは使われています",
  invalid: "入力内容を確認してください",
  server_error: "登録に失敗しました。時間をおいてもう一度お試しください",
};

async function clientIp(): Promise<string> {
  const h = await headers();
  const first = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const raw = {
    loginId: String(formData.get("loginId") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    password: String(formData.get("password") ?? ""),
    passphrase: String(formData.get("passphrase") ?? ""),
  };
  const next = safeNextPath(String(formData.get("next") ?? "") || null);
  const values = { loginId: raw.loginId, nickname: raw.nickname };

  const parsed = signupInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: NonNullable<SignupState["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof FIELD_MESSAGES;
      if (key in FIELD_MESSAGES) fieldErrors[key] = FIELD_MESSAGES[key];
    }
    return { fieldErrors, values };
  }

  const result = await registerUser(parsed.data, await clientIp());
  if (!result.ok) return { error: ERROR_MESSAGES[result.error], values };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(parsed.data.loginId),
    password: parsed.data.password,
  });
  // 画面の一時保存（staleTimes）を破棄して、地図や一覧に最新の状態を出す。
  revalidatePath("/", "layout");
  if (error) redirect("/login");

  redirect(next);
}
