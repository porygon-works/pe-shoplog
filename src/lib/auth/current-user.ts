import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  loginId: string;
  nickname: string;
  isAdmin: boolean;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, login_id, nickname, is_admin, disabled_at")
    .eq("id", sub)
    .maybeSingle();
  if (!profile || profile.disabled_at) return null;

  return {
    id: profile.id,
    loginId: profile.login_id,
    nickname: profile.nickname,
    isAdmin: profile.is_admin,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}
