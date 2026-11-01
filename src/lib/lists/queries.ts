import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PURPOSES, labelOf } from "@/lib/options";
import { type ListKind, excerptOf } from "./shared";

export type ListSummary = {
  id: string;
  name: string;
  kind: ListKind;
  isPublic: boolean;
  isDefault: boolean;
  shopCount: number;
};

/** list_id → 削除されていない店の件数。 */
async function liveShopCounts(supabase: SupabaseClient, listIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (listIds.length === 0) return counts;
  const { data, error } = await supabase
    .from("list_items")
    .select("list_id, shops!inner(deleted_at)")
    .in("list_id", listIds)
    .is("shops.deleted_at", null)
    .limit(10000);
  if (error) throw error;
  for (const r of data ?? []) counts.set(r.list_id, (counts.get(r.list_id) ?? 0) + 1);
  return counts;
}

/** あるユーザーのマイリスト（RLS により、本人以外には公開リストだけが見える）。既定のリストが先頭。 */
export async function listSummariesOf(supabase: SupabaseClient, ownerId: string): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, kind, is_public, is_default, created_at")
    .eq("owner_id", ownerId)
    .order("is_default", { ascending: false })
    .order("kind", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const counts = await liveShopCounts(
    supabase,
    rows.map((r) => r.id as string),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    isPublic: r.is_public,
    isDefault: r.is_default,
    shopCount: counts.get(r.id) ?? 0,
  }));
}

export type VisitLogEntry = {
  id: string;
  shopId: string;
  shopName: string;
  visitedOn: string | null;
  rating: number | null;
  purposeLabel: string;
  excerpt: string | null;
};

/** あるユーザーの、削除されていない記録（新しい順）。削除済みの店の記録は除く。 */
export async function visitLogOf(supabase: SupabaseClient, userId: string): Promise<VisitLogEntry[]> {
  const { data, error } = await supabase
    .from("visits")
    .select("id, shop_id, visited_on, rating, purpose, comment, shops!inner(name, deleted_at)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("shops.deleted_at", null)
    .order("visited_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((v) => {
    const shop = (Array.isArray(v.shops) ? v.shops[0] : v.shops) as { name: string } | null;
    return {
      id: v.id,
      shopId: v.shop_id,
      shopName: shop?.name ?? "",
      visitedOn: v.visited_on,
      rating: v.rating,
      purposeLabel: labelOf(PURPOSES, v.purpose),
      excerpt: excerptOf(v.comment),
    };
  });
}

export type SharedListSummary = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  memberCount: number;
  shopCount: number;
};

/** 自分が参加している共有リスト（新しく入った順）。店数は削除されていない店だけ。 */
export async function sharedListSummariesOf(supabase: SupabaseClient, userId: string): Promise<SharedListSummary[]> {
  const { data, error } = await supabase
    .from("shared_list_members")
    .select("joined_at, shared_lists(id, name, description, is_public)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  type L = { id: string; name: string; description: string | null; is_public: boolean };
  const lists = (data ?? []).flatMap((m) => {
    const l = (Array.isArray(m.shared_lists) ? m.shared_lists[0] : m.shared_lists) as L | null;
    return l ? [l] : [];
  });
  if (lists.length === 0) return [];
  const ids = lists.map((l) => l.id);
  const [members, items] = await Promise.all([
    supabase.from("shared_list_members").select("shared_list_id").in("shared_list_id", ids).limit(10000),
    supabase
      .from("shared_list_items")
      .select("shared_list_id, shops!inner(deleted_at)")
      .in("shared_list_id", ids)
      .is("shops.deleted_at", null)
      .limit(10000),
  ]);
  if (members.error) throw members.error;
  if (items.error) throw items.error;
  const count = (rows: { shared_list_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.shared_list_id, (m.get(r.shared_list_id) ?? 0) + 1);
    return m;
  };
  const mc = count(members.data);
  const ic = count(items.data);
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    isPublic: l.is_public,
    memberCount: mc.get(l.id) ?? 1,
    shopCount: ic.get(l.id) ?? 0,
  }));
}
