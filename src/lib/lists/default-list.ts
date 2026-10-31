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
