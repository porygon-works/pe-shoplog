"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX } from "@/lib/announcements";
import { requireAdmin } from "@/lib/auth/current-user";
import { isUuid } from "@/lib/ids";
import { logResult } from "@/lib/log/server";
import { createServerClient } from "@/lib/supabase/server";

export type AnnouncementFormState = { error?: string; ok?: boolean };

const SERVER_ERROR = "保存に失敗しました。時間をおいてもう一度お試しください";
const schema = z.object({
  title: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX),
  body: z.string().trim().max(ANNOUNCEMENT_BODY_MAX),
});

function parse(formData: FormData) {
  const r = schema.safeParse({ title: String(formData.get("title") ?? ""), body: String(formData.get("body") ?? "") });
  if (r.success) return { data: r.data };
  const field = r.error.issues[0]?.path[0];
  return {
    error:
      field === "title"
        ? `タイトルは1〜${ANNOUNCEMENT_TITLE_MAX}文字で入力してください`
        : `本文は${ANNOUNCEMENT_BODY_MAX}文字までです`,
  };
}

function done(): AnnouncementFormState {
  revalidatePath("/", "layout");
  return { ok: true };
}

async function createImpl(formData: FormData): Promise<AnnouncementFormState & { id?: string }> {
  const user = await requireAdmin();
  const p = parse(formData);
  if (!p.data) return { error: p.error };
  const supabase = await createServerClient();
  // 「自分だけ」は確認用。あとで「全員に出す」で全員に出せる。
  const onlyMe = formData.get("audience") === "me";
  const { data, error } = await supabase
    .from("announcements")
    .insert({ title: p.data.title, body: p.data.body, created_by: user.id, target_user_ids: onlyMe ? [user.id] : null })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createAnnouncement failed", error);
    return { error: SERVER_ERROR };
  }
  return { ...done(), id: data.id as string };
}

async function updateImpl(formData: FormData): Promise<AnnouncementFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "お知らせが見つかりませんでした" };
  const p = parse(formData);
  if (!p.data) return { error: p.error };
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({ title: p.data.title, body: p.data.body })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("updateAnnouncement failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "お知らせが見つかりませんでした" };
  return done();
}

async function deleteImpl(id: string): Promise<AnnouncementFormState> {
  await requireAdmin();
  if (!isUuid(id)) return { error: "お知らせが見つかりませんでした" };
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("announcements").delete().eq("id", id).select("id");
  if (error) {
    console.error("deleteAnnouncement failed", error);
    return { error: "削除に失敗しました。時間をおいてもう一度お試しください" };
  }
  if (!data || data.length === 0) return { error: "お知らせが見つかりませんでした" };
  return done();
}

async function publishToAllImpl(id: string): Promise<AnnouncementFormState> {
  await requireAdmin();
  if (!isUuid(id)) return { error: "お知らせが見つかりませんでした" };
  const supabase = await createServerClient();
  // 出した時刻を今にして、全員に未読として出す。
  const { data, error } = await supabase
    .from("announcements")
    .update({ target_user_ids: null, published_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("publishAnnouncement failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "お知らせが見つかりませんでした" };
  return done();
}

export async function publishAnnouncementToAllAction(id: string) {
  return logResult("announcement_publish", await publishToAllImpl(id), { announcementId: id });
}

export async function createAnnouncementAction(_prev: AnnouncementFormState, formData: FormData) {
  const res = await createImpl(formData);
  return logResult("announcement_create", res, { announcementId: res.id ?? null });
}

export async function updateAnnouncementAction(_prev: AnnouncementFormState, formData: FormData) {
  return logResult("announcement_update", await updateImpl(formData), { announcementId: String(formData.get("id") ?? "") });
}

export async function deleteAnnouncementAction(id: string) {
  return logResult("announcement_delete", await deleteImpl(id), { announcementId: id });
}
