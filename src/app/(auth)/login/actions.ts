"use server";

import { redirect } from "next/navigation";
import { normalizeLoginId, toAuthEmail } from "@/lib/auth/login-id";
import { safeNextPath } from "@/lib/auth/next-path";
import { createServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; loginId?: string };

const LOGIN_FAILED = "IDかパスワードが違います";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const loginId = normalizeLoginId(String(formData.get("loginId") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "") || null);

  if (!loginId || !password) return { error: LOGIN_FAILED, loginId };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(loginId),
    password,
  });
  if (error) return { error: LOGIN_FAILED, loginId };

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
