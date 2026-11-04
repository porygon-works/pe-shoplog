"use server";

import { revalidatePath } from "next/cache";
import { logResult } from "@/lib/log/server";
import { requireUser } from "@/lib/auth/current-user";
import { categoryLabelSchema, generateCategoryValue, isCategoryKind, type CategoryKind } from "@/lib/category-utils";
import { consumePlacesQuota } from "@/lib/places/quota";
import { createAdminClient } from "@/lib/supabase/admin";

export type QuickAddResult = { value: string; label: string } | { error: string };

const SERVER_ERROR = "追加できませんでした。時間をおいてもう一度お試しください";
const UNIQUE_VIOLATION = "23505";

/**
 * 店の登録・編集画面や記録の画面から、ログインしている人ならだれでもジャンル・形態・用途を追加できる。
 * 同じ名前がすでにあればそれを返す（重複して作らない）。管理者が非表示にした名前は使えない。
 * 名前の変更・非表示は今までどおり管理画面（管理者のみ）で行う。
 */
async function quickAddCategoryImpl(kind: CategoryKind, rawLabel: string): Promise<QuickAddResult> {
  const user = await requireUser();
  if (!isCategoryKind(kind)) return { error: SERVER_ERROR };
  const parsed = categoryLabelSchema.safeParse(rawLabel);
  if (!parsed.success) return { error: "名前は 1〜20 文字で入力してください" };
  const label = parsed.data;

  // shop_categories への追加は RLS で管理者のみなので、確認を済ませてから secret キーで行う。
  const admin = createAdminClient();
  const { data: rows, error: loadError } = await admin
    .from("shop_categories")
    .select("value, label, hidden, sort_order")
    .eq("kind", kind);
  if (loadError) {
    console.error("quickAddCategory load failed", loadError);
    return { error: SERVER_ERROR };
  }
  const same = (rows ?? []).find((r) => r.label === label);
  if (same) {
    if (same.hidden) return { error: `「${label}」は管理者が使わないように設定しています` };
    return { value: same.value, label: same.label };
  }
  if (label === "不明") return { error: "「不明」は追加できません" };

  if (!(await consumePlacesQuota("category", user.id))) {
    return { error: "今日はこれ以上追加できません。明日もう一度お試しください" };
  }

  // 「その他」「不明」より前（既存の最後のふつうの区分の後ろ）に並べる。
  const tail = (rows ?? []).filter((r) => r.value === "other" || r.value === "unknown").map((r) => r.sort_order);
  const body = (rows ?? []).filter((r) => r.value !== "other" && r.value !== "unknown").map((r) => r.sort_order);
  const before = tail.length ? Math.min(...tail) : Infinity;
  const last = body.filter((n) => n < before).reduce((m, n) => Math.max(m, n), 0);
  const sortOrder = Number.isFinite(before) && before - last > 1 ? last + Math.floor((before - last) / 2) : last + 10;

  for (let i = 0; i < 3; i++) {
    const value = generateCategoryValue();
    const { error } = await admin.from("shop_categories").insert({ kind, value, label, sort_order: sortOrder });
    if (!error) {
      revalidatePath("/", "layout");
      return { value, label };
    }
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("quickAddCategory failed", error);
      return { error: SERVER_ERROR };
    }
  }
  return { error: SERVER_ERROR };
}

export async function quickAddCategoryAction(kind: CategoryKind, rawLabel: string) {
  return logResult("category_add", await quickAddCategoryImpl(kind, rawLabel), { kind, label: rawLabel });
}
