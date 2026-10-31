import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopCardData } from "@/components/shop-card";
import { applyShopFilters, type ShopFilters } from "./shop-filters";

const SIGNED_URL_SECONDS = 3600;
// .in() の URL が長くなりすぎないよう、写真の問い合わせは店 ID をこの件数ずつに分ける。
const PHOTO_CHUNK = 100;

export type ListedShop = ShopCardData & { lat: number; lng: number; placeId: string | null };

/** shop_index を絞り込み、各店の最新の写真 1 枚を一括で署名して返す。 */
export async function listShops(supabase: SupabaseClient, filters: ShopFilters): Promise<ListedShop[]> {
  const { data, error } = await applyShopFilters(
    supabase
      .from("shop_index")
      .select("id, name, genre, styles, visit_count, smoking, price_range, lat, lng, place_id"),
    filters,
  );
  if (error) throw error;
  const rows = data ?? [];
  const thumbs = await thumbnailUrls(
    supabase,
    rows.map((r) => r.id as string),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    genre: r.genre,
    styles: r.styles ?? [],
    visitCount: r.visit_count,
    smoking: r.smoking,
    priceRange: r.price_range,
    thumbUrl: thumbs.get(r.id) ?? null,
    lat: r.lat,
    lng: r.lng,
    placeId: r.place_id,
  }));
}

/** 店 ID → 最新の有効な写真の署名付き URL。削除済みの記録・写真は除く。 */
async function thumbnailUrls(supabase: SupabaseClient, shopIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (shopIds.length === 0) return out;

  const chunks: string[][] = [];
  for (let i = 0; i < shopIds.length; i += PHOTO_CHUNK) chunks.push(shopIds.slice(i, i + PHOTO_CHUNK));
  const results = await Promise.all(
    chunks.map((ids) =>
      supabase
        .from("photos")
        .select("shop_id, storage_path, created_at, visits!inner(deleted_at)")
        .in("shop_id", ids)
        .is("deleted_at", null)
        .is("visits.deleted_at", null)
        .order("created_at", { ascending: false }),
    ),
  );

  const pathByShop = new Map<string, string>();
  for (const res of results) {
    if (res.error) throw res.error;
    for (const p of res.data ?? []) {
      if (!pathByShop.has(p.shop_id)) pathByShop.set(p.shop_id, p.storage_path);
    }
  }
  if (pathByShop.size === 0) return out;

  const { data: signed, error } = await supabase.storage
    .from("photos")
    .createSignedUrls([...pathByShop.values()], SIGNED_URL_SECONDS);
  if (error) throw error;
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  for (const [shopId, path] of pathByShop) {
    const url = urlByPath.get(path);
    if (url) out.set(shopId, url);
  }
  return out;
}
