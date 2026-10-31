import type { SupabaseClient } from "@supabase/supabase-js";

/** 自分の既定リスト（気になる / お気に入り）に店を入れる。すでに入っていてもエラーにしない。 */
export async function addShopToDefaultList(
  supabase: SupabaseClient,
  userId: string,
  shopId: string,
  kind: "want" | "favorite",
): Promise<void> {
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("owner_id", userId)
    .eq("kind", kind)
    .eq("is_default", true)
    .maybeSingle();
  if (listError) throw listError;
  if (!list) throw new Error(`既定のリスト(${kind})が見つかりません`);

  const { error } = await supabase
    .from("list_items")
    .upsert({ list_id: list.id, shop_id: shopId }, { onConflict: "list_id,shop_id", ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * その種類のどのリストにも入っていなければ、既定のリストに入れる。
 * 削除済み（または存在しない）店は入れず "shop_missing" を返す。
 */
export async function ensureShopInDefaultList(
  supabase: SupabaseClient,
  userId: string,
  shopId: string,
  kind: "want" | "favorite",
): Promise<"added" | "present" | "shop_missing"> {
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .is("deleted_at", null)
    .maybeSingle();
  if (shopError) throw shopError;
  if (!shop) return "shop_missing";

  const { data: existing, error: existingError } = await supabase
    .from("lists")
    .select("id, list_items!inner(shop_id)")
    .eq("owner_id", userId)
    .eq("kind", kind)
    .eq("list_items.shop_id", shopId)
    .limit(1);
  if (existingError) throw existingError;
  if ((existing ?? []).length > 0) return "present";

  await addShopToDefaultList(supabase, userId, shopId, kind);
  return "added";
}
