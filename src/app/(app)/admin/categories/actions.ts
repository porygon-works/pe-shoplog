"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current-user";
import {
  categoryLabelSchema,
  generateCategoryValue,
  hasDuplicateLabel,
  type Category,
  isCategoryKind,
  type CategoryKind,
} from "@/lib/category-utils";
import { createServerClient } from "@/lib/supabase/server";

type Out = { ok: true } | { error: string };

const SERVER_ERROR = "処理に失敗しました。時間をおいてもう一度お試しください";
const LABEL_ERROR = "表示名は 1〜20 文字で入力してください";
const DUPLICATE_ERROR = "同じ表示名の区分がすでにあります（非表示のものを含みます）";
const NOT_FOUND = "対象が見つかりませんでした";
const UNIQUE_VIOLATION = "23505";

type Row = { id: string; kind: CategoryKind; value: string; label: string; hidden: boolean; sort_order: number };

/** 管理画面からの変更は RLS（is_admin）を通すため、ログイン中のユーザーのクライアントで行う。 */
async function loadKind(kind: CategoryKind): Promise<{ rows: Row[] } | { error: string }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("shop_categories")
    .select("id, kind, value, label, hidden, sort_order")
    .eq("kind", kind)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) {
    console.error("load categories failed", error);
    return { error: SERVER_ERROR };
  }
  return { rows: (data ?? []) as Row[] };
}

async function loadOne(kind: CategoryKind, value: string): Promise<{ row: Row; rows: Row[] } | { error: string }> {
  if (!isCategoryKind(kind)) return { error: SERVER_ERROR };
  const all = await loadKind(kind);
  if ("error" in all) return all;
  const row = all.rows.find((r) => r.value === value);
  return row ? { row, rows: all.rows } : { error: NOT_FOUND };
}

const asCategories = (rows: Row[]): Category[] =>
  rows.map((r) => ({ value: r.value, label: r.label, hidden: r.hidden, sortOrder: r.sort_order }));

function done(): Out {
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addCategoryAction(kind: CategoryKind, rawLabel: string): Promise<Out> {
  await requireAdmin();
  if (!isCategoryKind(kind)) return { error: SERVER_ERROR };
  const label = categoryLabelSchema.safeParse(rawLabel);
  if (!label.success) return { error: LABEL_ERROR };

  const loaded = await loadKind(kind);
  if ("error" in loaded) return loaded;
  if (hasDuplicateLabel(asCategories(loaded.rows), label.data)) return { error: DUPLICATE_ERROR };

  const sortOrder = loaded.rows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 10;
  const supabase = await createServerClient();
  for (let i = 0; i < 3; i++) {
    const { error } = await supabase
      .from("shop_categories")
      .insert({ kind, value: generateCategoryValue(), label: label.data, sort_order: sortOrder });
    if (!error) return done();
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("addCategory failed", error);
      return { error: SERVER_ERROR };
    }
  }
  return { error: SERVER_ERROR };
}

export async function renameCategoryAction(kind: CategoryKind, value: string, rawLabel: string): Promise<Out> {
  await requireAdmin();
  const label = categoryLabelSchema.safeParse(rawLabel);
  if (!label.success) return { error: LABEL_ERROR };

  const loaded = await loadOne(kind, value);
  if ("error" in loaded) return loaded;
  if (hasDuplicateLabel(asCategories(loaded.rows), label.data, loaded.row.value)) return { error: DUPLICATE_ERROR };

  const supabase = await createServerClient();
  const { error } = await supabase.from("shop_categories").update({ label: label.data }).eq("id", loaded.row.id);
  if (error) {
    console.error("renameCategory failed", error);
    return { error: SERVER_ERROR };
  }
  return done();
}

export async function moveCategoryAction(kind: CategoryKind, value: string, direction: "up" | "down"): Promise<Out> {
  await requireAdmin();
  if (direction !== "up" && direction !== "down") return { error: SERVER_ERROR };
  const loaded = await loadOne(kind, value);
  if ("error" in loaded) return loaded;

  const rows = [...loaded.rows];
  const from = rows.findIndex((r) => r.value === value);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= rows.length) return done();
  [rows[from], rows[to]] = [rows[to], rows[from]];

  // 並び順が重複していても確実に入れ替わるよう、全体を 10 刻みで振り直す（変わった行だけ更新）。
  const supabase = await createServerClient();
  for (const [i, r] of rows.entries()) {
    const sortOrder = (i + 1) * 10;
    if (r.sort_order === sortOrder) continue;
    const { error } = await supabase.from("shop_categories").update({ sort_order: sortOrder }).eq("id", r.id);
    if (error) {
      console.error("moveCategory failed", error);
      return { error: SERVER_ERROR };
    }
  }
  return done();
}

export async function setCategoryHiddenAction(kind: CategoryKind, value: string, hidden: boolean): Promise<Out> {
  await requireAdmin();
  const loaded = await loadOne(kind, value);
  if ("error" in loaded) return loaded;
  if (hidden && kind === "genre" && value === "unknown") {
    return { error: "「不明」は未選択時の既定値なので非表示にできません" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("shop_categories").update({ hidden }).eq("id", loaded.row.id);
  if (error) {
    console.error("setCategoryHidden failed", error);
    return { error: SERVER_ERROR };
  }
  return done();
}
