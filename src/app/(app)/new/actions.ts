"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { addShopToDefaultList } from "@/lib/lists/default-list";
import { isValidPlaceId } from "@/lib/places/google";
import { createShop } from "@/lib/shops/create-shop";
import { createServerClient } from "@/lib/supabase/server";
import { shopInputSchema } from "@/lib/validation";

export type NewShopState = { error?: string };

const SERVER_ERROR = "登録に失敗しました。時間をおいてもう一度お試しください";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function createShopAction(
  _prev: NewShopState,
  formData: FormData,
): Promise<NewShopState> {
  // proxy だけでは停止中のユーザーを止められないので、Server Action でも必ず確認する。
  const user = await requireUser();

  const mode = text(formData, "mode");
  if (mode !== "want" && mode !== "visit") return { error: "登録方法が正しくありません" };

  const parsed = shopInputSchema.safeParse({
    name: text(formData, "name"),
    genre: text(formData, "genre") || "unknown",
    styles: formData.getAll("styles").map(String),
    referenceUrl: text(formData, "referenceUrl").trim(),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") return { error: "店名を1〜100文字で入力してください" };
    if (field === "referenceUrl") return { error: "予約・参考リンクは http:// または https:// で始まるURLを入力してください" };
    return { error: "入力内容を確認してください" };
  }

  const rawPlaceId = text(formData, "placeId").trim();
  if (rawPlaceId && !isValidPlaceId(rawPlaceId)) return { error: "店の情報が正しくありません" };
  const placeId = rawPlaceId || null;

  const latText = text(formData, "lat").trim();
  const lngText = text(formData, "lng").trim();
  const lat = latText === "" ? NaN : Number(latText);
  const lng = lngText === "" ? NaN : Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: placeId ? "店の場所を取得できませんでした" : "地図で店の場所を指定してください" };
  }

  const supabase = await createServerClient();
  let shopId: string;
  let existed: boolean;
  try {
    ({ shopId, existed } = await createShop(supabase, { ...parsed.data, userId: user.id, placeId, lat, lng }));
  } catch (e) {
    console.error("createShop failed", e);
    return { error: SERVER_ERROR };
  }

  if (existed) redirect(`/shops/${shopId}?notice=exists`);

  if (mode === "visit") redirect(`/shops/${shopId}/visits/new`);

  try {
    await addShopToDefaultList(supabase, user.id, shopId, "want");
  } catch (e) {
    console.error("addShopToDefaultList failed", e);
    // 店は作成済みなので、やり直しで重複させず詳細ページへ進めて知らせる。
    redirect(`/shops/${shopId}?notice=list_failed`);
  }
  redirect(`/shops/${shopId}`);
}
