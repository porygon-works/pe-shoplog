"use server";

import { revalidatePath } from "next/cache";
import { errorInfo, logEvent, logResult } from "@/lib/log/server";
import { redirect, RedirectType } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";
import { CHECK_VIOLATION, INVALID_CATEGORY_MESSAGE, hasInvalidCategory } from "@/lib/category-utils";
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
  prev: NewShopState,
  formData: FormData,
): Promise<NewShopState> {
  const res = await createShopImpl(prev, formData);
  // 成功時は redirect（例外）で抜けるので、ここに来るのは入力エラーなどで画面に戻すときだけ。
  logResult("shop_create", res, { mode: text(formData, "mode"), placeId: text(formData, "placeId") || null });
  return res;
}

async function createShopImpl(
  _prev: NewShopState,
  formData: FormData,
): Promise<NewShopState> {
  // proxy だけでは停止中のユーザーを止められないので、Server Action でも必ず確認する。
  const user = await requireUser();

  const mode = text(formData, "mode");
  if (mode !== "want" && mode !== "visit") return { error: "登録方法が正しくありません" };

  const parsed = shopInputSchema.safeParse({
    name: text(formData, "name"),
    genres: formData.getAll("genres").map(String),
    styles: formData.getAll("styles").map(String),
    smoking: text(formData, "smoking") || "unknown",
    timeSlots: formData.getAll("timeSlots").map(String),
    // 参考リンクは登録時には入力しない（店の編集画面で付ける）。
    referenceUrl: "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") return { error: "店名を1〜100文字で入力してください" };
    if (field === "timeSlots") return { error: "時間帯を1つ以上選んでください" };
    return { error: "入力内容を確認してください" };
  }

  // 新規の選択は非表示の区分を選べない。DB のトリガーが最後の砦。
  if (hasInvalidCategory(await getCategories(), parsed.data)) return { error: INVALID_CATEGORY_MESSAGE };

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
    if ((e as { code?: string } | null)?.code === CHECK_VIOLATION) return { error: INVALID_CATEGORY_MESSAGE };
    return { error: SERVER_ERROR };
  }

  // 画面の一時保存（staleTimes）を破棄して、地図や一覧に最新の状態を出す。
  revalidatePath("/", "layout");
  if (existed) {
    logEvent({ action: "shop_create", detail: { mode, shopId, existed: true } });
    redirect(`/shops/${shopId}?notice=exists`, RedirectType.replace);
  }

  if (mode === "visit") {
    // 「行った」はこの時点で記録を 1 件作る（入力画面を閉じても「行った」が残るように）。
    // 日付や★・コメントは、続く編集画面で任意で書き足す。
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .insert({ shop_id: shopId, user_id: user.id, visited_on: today })
      .select("id")
      .single();
    if (visitError || !visit) {
      console.error("create visit on register failed", visitError);
      logEvent({ action: "shop_create", level: "error", detail: { mode, shopId, step: "visit", ...errorInfo(visitError) } });
      // 店はできているので、これまでどおり記録の入力画面へ進める。
      redirect(`/shops/${shopId}/visits/new`, RedirectType.replace);
    }
    logEvent({ action: "shop_create", detail: { mode, shopId, visitId: visit.id } });
    revalidatePath("/", "layout");
    redirect(`/visits/${visit.id}/edit?new=1`, RedirectType.replace);
  }

  try {
    await addShopToDefaultList(supabase, user.id, shopId, "want");
  } catch (e) {
    console.error("addShopToDefaultList failed", e);
    logEvent({ action: "shop_create", level: "error", detail: { mode, shopId, step: "want_list", ...errorInfo(e) } });
    // 店は作成済みなので、やり直しで重複させず詳細ページへ進めて知らせる。
    redirect(`/shops/${shopId}?notice=list_failed`, RedirectType.replace);
  }
  logEvent({ action: "shop_create", detail: { mode, shopId } });
  redirect(`/shops/${shopId}`, RedirectType.replace);
}
