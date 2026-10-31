"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { isUuid } from "@/lib/ids";
import { addShopToDefaultList } from "@/lib/lists/default-list";
import { createServerClient } from "@/lib/supabase/server";
import {
  LIST_NAME_MAX,
  type ListKind,
  type PickerList,
  normalizeListName,
} from "./shared";

const SERVER_ERROR = "保存に失敗しました。時間をおいてもう一度お試しください";

export type ActionError = { error: string };

const isKind = (k: unknown): k is ListKind => k === "want" || k === "favorite";

/** リスト選択シートに出す、自分のリストと「この店が入っているか」。既定のリストを先頭にする。 */
export async function listPickerDataAction(
  shopId: string,
  kind?: ListKind,
): Promise<{ lists: PickerList[] } | ActionError> {
  const user = await requireUser();
  if (!isUuid(shopId)) return { error: "店の情報が正しくありません" };
  if (kind !== undefined && !isKind(kind)) return { error: "リストの種類が正しくありません" };

  const supabase = await createServerClient();
  let query = supabase
    .from("lists")
    .select("id, name, kind, is_public, is_default, created_at, list_items(shop_id)")
    .eq("owner_id", user.id)
    .eq("list_items.shop_id", shopId);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) {
    console.error("listPickerData failed", error);
    return { error: "リストを読み込めませんでした。時間をおいてもう一度お試しください" };
  }
  const lists: PickerList[] = (data ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    kind: l.kind as ListKind,
    isPublic: l.is_public as boolean,
    isDefault: l.is_default as boolean,
    included: ((l.list_items as unknown[] | null) ?? []).length > 0,
    createdAt: l.created_at as string,
  }));
  return { lists };
}

export async function setListItemAction(
  listId: string,
  shopId: string,
  included: boolean,
): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(listId) || !isUuid(shopId)) return { error: "リストまたは店の情報が正しくありません" };

  const supabase = await createServerClient();
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (listError) {
    console.error("setListItem list lookup failed", listError);
    return { error: SERVER_ERROR };
  }
  if (!list) return { error: "リストが見つかりませんでした" };

  if (included) {
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("id", shopId)
      .is("deleted_at", null)
      .maybeSingle();
    if (shopError) {
      console.error("setListItem shop lookup failed", shopError);
      return { error: SERVER_ERROR };
    }
    if (!shop) return { error: "店が見つかりませんでした" };
    const { error } = await supabase
      .from("list_items")
      .upsert({ list_id: listId, shop_id: shopId }, { onConflict: "list_id,shop_id", ignoreDuplicates: true });
    if (error) {
      console.error("setListItem insert failed", error);
      return { error: SERVER_ERROR };
    }
  } else {
    const { error } = await supabase.from("list_items").delete().eq("list_id", listId).eq("shop_id", shopId);
    if (error) {
      console.error("setListItem delete failed", error);
      return { error: SERVER_ERROR };
    }
  }
  revalidatePath(`/shops/${shopId}`);
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/me");
  return { ok: true };
}

export async function createListAction(input: {
  name: string;
  kind: ListKind;
  isPublic: boolean;
}): Promise<{ listId: string } | ActionError> {
  const user = await requireUser();
  const name = normalizeListName(input?.name);
  if (!name) return { error: `リスト名は1〜${LIST_NAME_MAX}文字で入力してください` };
  if (!isKind(input.kind)) return { error: "リストの種類が正しくありません" };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("lists")
    .insert({ owner_id: user.id, name, kind: input.kind, is_public: input.isPublic === true })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createList failed", error);
    return { error: SERVER_ERROR };
  }
  revalidatePath("/me");
  return { listId: data.id as string };
}

export async function updateListAction(
  listId: string,
  patch: { name?: string; isPublic?: boolean },
): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(listId)) return { error: "リストの情報が正しくありません" };
  const update: { name?: string; is_public?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) {
    const name = normalizeListName(patch.name);
    if (!name) return { error: `リスト名は1〜${LIST_NAME_MAX}文字で入力してください` };
    update.name = name;
  }
  if (patch.isPublic !== undefined) update.is_public = patch.isPublic === true;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("lists")
    .update(update)
    .eq("id", listId)
    .eq("owner_id", user.id)
    .select("id");
  if (error) {
    console.error("updateList failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "リストが見つかりませんでした" };
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/me");
  return { ok: true };
}

/** 既定のリストは削除できない（DB の RLS も同じ条件で拒否する）。 */
export async function deleteListAction(listId: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(listId)) return { error: "リストの情報が正しくありません" };

  const supabase = await createServerClient();
  const { data: list, error: lookupError } = await supabase
    .from("lists")
    .select("id, is_default")
    .eq("id", listId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (lookupError) {
    console.error("deleteList lookup failed", lookupError);
    return { error: SERVER_ERROR };
  }
  if (!list) return { error: "リストが見つかりませんでした" };
  if (list.is_default) return { error: "既定のリストは削除できません" };

  const { data, error } = await supabase
    .from("lists")
    .delete()
    .eq("id", listId)
    .eq("owner_id", user.id)
    .select("id");
  if (error) {
    console.error("deleteList failed", error);
    return { error: "削除に失敗しました。時間をおいてもう一度お試しください" };
  }
  if (!data || data.length === 0) return { error: "リストが見つかりませんでした" };
  revalidatePath("/me");
  return { ok: true };
}

export async function updateNicknameAction(nickname: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  const value = typeof nickname === "string" ? nickname.trim() : "";
  if (value.length < 1 || value.length > 20) return { error: "ニックネームは1〜20文字で入力してください" };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ nickname: value, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id");
  if (error) {
    console.error("updateNickname failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "ユーザーが見つかりませんでした" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * 「気になる」「お気に入り」を押したとき、その種類のどのリストにも入っていなければ既定のリストに入れる。
 * すでにどこかに入っていれば何もしない。入れたときだけ added: true を返す。
 */
export async function ensureInDefaultListAction(
  shopId: string,
  kind: ListKind,
): Promise<{ added: boolean } | ActionError> {
  const user = await requireUser();
  if (!isUuid(shopId)) return { error: "店の情報が正しくありません" };
  if (!isKind(kind)) return { error: "リストの種類が正しくありません" };

  const supabase = await createServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("lists")
    .select("id, list_items!inner(shop_id)")
    .eq("owner_id", user.id)
    .eq("kind", kind)
    .eq("list_items.shop_id", shopId)
    .limit(1);
  if (existingError) {
    console.error("ensureInDefaultList lookup failed", existingError);
    return { error: SERVER_ERROR };
  }
  if ((existing ?? []).length > 0) return { added: false };

  try {
    await addShopToDefaultList(supabase, user.id, shopId, kind);
  } catch (e) {
    console.error("ensureInDefaultList failed", e);
    return { error: SERVER_ERROR };
  }
  revalidatePath(`/shops/${shopId}`);
  revalidatePath("/me");
  return { added: true };
}
