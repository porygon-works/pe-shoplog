import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type Announcement = { id: string; title: string; body: string; createdAt: string };

export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_BODY_MAX = 2000;

/** お知らせ（新しい順）。 */
export async function listAnnouncements(supabase: SupabaseClient, limit = 100): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, body: r.body, createdAt: r.created_at }));
}

/** 最後にお知らせ一覧を開いたあとに、新しいお知らせがあるか。 */
export async function hasUnreadAnnouncements(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const [latest, read] = await Promise.all([
    supabase.from("announcements").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("announcement_reads").select("read_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (latest.error) throw latest.error;
  if (read.error) throw read.error;
  if (!latest.data) return false;
  if (!read.data) return true;
  return new Date(latest.data.created_at) > new Date(read.data.read_at);
}

/** 日本時間の「2026/11/16」。 */
export function announcementDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });
}
