import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  /** null = 全員。配列ならその人たちだけ。 */
  targetUserIds: string[] | null;
};

export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_BODY_MAX = 2000;

/** 自分あてのお知らせ（全員あて＋自分が対象のもの）の条件。管理者でも他人あてのものは含めない。 */
const visibleTo = (userId: string) => `target_user_ids.is.null,target_user_ids.cs.{${userId}}`;

/**
 * お知らせ（出した順の新しい順）。userId を渡すとその人あてのものだけ、渡さなければ全部（管理画面用、RLS で管理者のみ）。
 */
export async function listAnnouncements(
  supabase: SupabaseClient,
  opts: { userId?: string; limit?: number } = {},
): Promise<Announcement[]> {
  let q = supabase
    .from("announcements")
    .select("id, title, body, published_at, target_user_ids")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.userId) q = q.or(visibleTo(opts.userId));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    publishedAt: r.published_at,
    targetUserIds: r.target_user_ids,
  }));
}

/** 最後にお知らせ画面を開いたあとに出た、自分あてのお知らせの件数。 */
export async function unreadAnnouncementCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const read = await supabase.from("announcement_reads").select("read_at").eq("user_id", userId).maybeSingle();
  if (read.error) throw read.error;
  let q = supabase.from("announcements").select("id", { count: "exact", head: true }).or(visibleTo(userId));
  if (read.data) q = q.gt("published_at", read.data.read_at);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** 日本時間の「2026/11/16」。 */
export function announcementDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });
}

/** バッジに出す件数（10 件以上は「9+」）。 */
export function badgeText(n: number): string {
  return n > 9 ? "9+" : String(n);
}
