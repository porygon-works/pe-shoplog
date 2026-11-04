"use server";

import { isUuid } from "@/lib/ids";
import { revalidatePath } from "next/cache";
import { logResult } from "@/lib/log/server";
import { requireUser } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";
import { CHECK_VIOLATION, INVALID_CATEGORY_MESSAGE, hasInvalidCategory } from "@/lib/category-utils";
import { createServerClient } from "@/lib/supabase/server";
import { shopInputSchema } from "@/lib/validation";

export type EditShopState = { error?: string; ok?: boolean };

const SERVER_ERROR = "保存に失敗しました。時間をおいてもう一度お試しください";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** 店名・ジャンル・形態・時間帯・参考リンクだけを更新する（位置や place_id は変えない）。 */
async function updateShopImpl(
  _prev: EditShopState,
  formData: FormData,
): Promise<EditShopState> {
  await requireUser();

  const shopId = text(formData, "shopId");
  if (!isUuid(shopId)) return { error: "店の情報が正しくありません" };

  const parsed = shopInputSchema.safeParse({
    name: text(formData, "name"),
    genres: formData.getAll("genres").map(String),
    styles: formData.getAll("styles").map(String),
    smoking: text(formData, "smoking") || "unknown",
    timeSlots: formData.getAll("timeSlots").map(String),
    referenceUrl: text(formData, "referenceUrl").trim(),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") return { error: "店名を1〜100文字で入力してください" };
    if (field === "timeSlots") return { error: "時間帯を1つ以上選んでください" };
    if (field === "referenceUrl") return { error: "予約・参考リンクは http:// または https:// で始まるURLを入力してください" };
    return { error: "入力内容を確認してください" };
  }

  const supabase = await createServerClient();

  // 元の値なら非表示の区分でも保てる。新しく選ぶ値は非表示不可。
  const { data: current, error: currentError } = await supabase
    .from("shops")
    .select("genres, styles")
    .eq("id", shopId)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentError) {
    console.error("updateShop failed", currentError);
    return { error: SERVER_ERROR };
  }
  if (!current) return { error: "店が見つかりませんでした" };
  const currentValues = { genres: (current.genres ?? []) as string[], styles: (current.styles ?? []) as string[] };
  if (hasInvalidCategory(await getCategories(), parsed.data, currentValues)) {
    return { error: INVALID_CATEGORY_MESSAGE };
  }

  const { data, error } = await supabase
    .from("shops")
    .update({
      name: parsed.data.name,
      genres: parsed.data.genres,
      styles: parsed.data.styles,
      smoking: parsed.data.smoking,
      time_slots: parsed.data.timeSlots,
      reference_url: parsed.data.referenceUrl === "" ? null : parsed.data.referenceUrl,
    })
    .eq("id", shopId)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    console.error("updateShop failed", error);
    if (error.code === CHECK_VIOLATION) return { error: INVALID_CATEGORY_MESSAGE };
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "店が見つかりませんでした" };

  // 画面の一時保存（staleTimes）を破棄して、地図や一覧に最新の状態を出す。
  revalidatePath("/", "layout");
  // 画面側で詳細へ戻る（redirect で進むと、戻るで編集画面と詳細を行き来してしまう）。
  return { ok: true };
}

export async function updateShopAction(prev: EditShopState, formData: FormData) {
  return logResult("shop_update", await updateShopImpl(prev, formData), { shopId: formData.get("shopId") });
}
