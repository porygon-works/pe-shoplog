"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { shopInputSchema } from "@/lib/validation";

export type EditShopState = { error?: string };

const SERVER_ERROR = "保存に失敗しました。時間をおいてもう一度お試しください";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** 店名・ジャンル・形態・参考リンクだけを更新する（位置や place_id は変えない）。 */
export async function updateShopAction(
  _prev: EditShopState,
  formData: FormData,
): Promise<EditShopState> {
  await requireUser();

  const shopId = text(formData, "shopId");
  if (!/^[0-9a-f-]{36}$/i.test(shopId)) return { error: "店の情報が正しくありません" };

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

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("shops")
    .update({
      name: parsed.data.name,
      genre: parsed.data.genre,
      styles: parsed.data.styles,
      reference_url: parsed.data.referenceUrl === "" ? null : parsed.data.referenceUrl,
    })
    .eq("id", shopId)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    console.error("updateShop failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "店が見つかりませんでした" };

  redirect(`/shops/${shopId}`);
}
