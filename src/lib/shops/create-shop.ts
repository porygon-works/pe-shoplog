import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopInput } from "@/lib/validation";

export type CreateShopInput = ShopInput & {
  /** 作成者。RLS の `created_by = auth.uid()` と一致させる。 */
  userId: string;
  placeId: string | null;
  lat: number;
  lng: number;
};

const UNIQUE_VIOLATION = "23505";

/**
 * 店を作る。同じ place_id の店がすでにあれば（同時登録の競合を含む）、
 * 新規作成はせず既存の店の id を `existed: true` で返す。
 */
export async function createShop(
  supabase: SupabaseClient,
  input: CreateShopInput,
): Promise<{ shopId: string; existed: boolean }> {
  if (input.placeId) {
    const existing = await findByPlaceId(supabase, input.placeId);
    if (existing) return { shopId: existing, existed: true };
  }

  const { data, error } = await supabase
    .from("shops")
    .insert({
      place_id: input.placeId,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      location_fetched_at: input.placeId ? new Date().toISOString() : null,
      genres: input.genres,
      styles: input.styles,
      time_slots: input.timeSlots,
      reference_url: input.referenceUrl === "" ? null : input.referenceUrl,
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION && input.placeId) {
      const existing = await findByPlaceId(supabase, input.placeId);
      if (existing) return { shopId: existing, existed: true };
    }
    throw error;
  }
  return { shopId: data.id as string, existed: false };
}

async function findByPlaceId(supabase: SupabaseClient, placeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("shops")
    .select("id")
    .eq("place_id", placeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}
