import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopCardData } from "@/components/shop-card";
import { applyShopFilters, type ShopFilters } from "./shop-filters";

const SIGNED_URL_SECONDS = 3600;
// .in() の URL が長くなりすぎないよう、写真の問い合わせは店 ID をこの件数ずつに分ける。
const PHOTO_CHUNK = 100;

const CARD_COLUMNS = "id, name, genre, styles, visit_count, smoking, price_range";

type CardRow = {
  id: string;
  name: string;
  genre: string;
  styles: string[] | null;
  visit_count: number;
  smoking: string;
  price_range: string;
};

/** shop_index の 1 行を店カード用のデータにする。 */
function toCardData(r: CardRow, thumbUrl: string | null): ShopCardData {
  return {
    id: r.id,
    name: r.name,
    genre: r.genre,
    styles: r.styles ?? [],
    visitCount: r.visit_count,
    smoking: r.smoking,
    priceRange: r.price_range,
    thumbUrl,
  };
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type ListedShop = ShopCardData & { lat: number; lng: number; placeId: string | null };

/** shop_index を絞り込み、各店の最新の写真 1 枚を一括で署名して返す。 */
export async function listShops(supabase: SupabaseClient, filters: ShopFilters): Promise<ListedShop[]> {
  const { data, error } = await applyShopFilters(
    supabase
      .from("shop_index")
      .select(`${CARD_COLUMNS}, lat, lng, place_id`),
    filters,
  );
  if (error) throw error;
  const rows = data ?? [];
  const thumbs = await thumbnailUrls(
    supabase,
    rows.map((r) => r.id as string),
  );

  return rows.map((r) => ({
    ...toCardData(r as CardRow, thumbs.get(r.id) ?? null),
    lat: r.lat,
    lng: r.lng,
    placeId: r.place_id,
  }));
}

/**
 * 店 ID の配列から店カード用のデータを返す（渡した順を保つ）。削除済みの店は shop_index に
 * 出てこないので、結果から自然に外れる。リスト画面など ID が先に決まっている一覧で使う。
 */
export async function shopCardsByIds(supabase: SupabaseClient, shopIds: string[]): Promise<ShopCardData[]> {
  if (shopIds.length === 0) return [];
  const results = await Promise.all(
    chunked(shopIds, PHOTO_CHUNK).map((ids) => supabase.from("shop_index").select(CARD_COLUMNS).in("id", ids)),
  );
  const rows = new Map<string, CardRow>();
  for (const res of results) {
    if (res.error) throw res.error;
    for (const r of (res.data ?? []) as unknown as CardRow[]) rows.set(r.id, r);
  }
  const thumbs = await thumbnailUrls(supabase, [...rows.keys()]);
  return shopIds.flatMap((id) => {
    const r = rows.get(id);
    return r ? [toCardData(r, thumbs.get(id) ?? null)] : [];
  });
}

/** 店 ID → 最新の有効な写真の署名付き URL。削除済みの記録・写真は除く。 */
async function thumbnailUrls(supabase: SupabaseClient, shopIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (shopIds.length === 0) return out;

  const results = await Promise.all(
    chunked(shopIds, PHOTO_CHUNK).map((ids) =>
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
