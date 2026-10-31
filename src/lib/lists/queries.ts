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
  visitedOn: string;
  purposeLabel: string;
  excerpt: string | null;
};

/** あるユーザーの、削除されていない記録（新しい順）。削除済みの店の記録は除く。 */
export async function visitLogOf(supabase: SupabaseClient, userId: string): Promise<VisitLogEntry[]> {
  const { data, error } = await supabase
    .from("visits")
    .select("id, shop_id, visited_on, purpose, comment, shops!inner(name, deleted_at)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("shops.deleted_at", null)
    .order("visited_on", { ascending: false })
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
      purposeLabel: labelOf(PURPOSES, v.purpose),
      excerpt: excerptOf(v.comment),
    };
  });
}
