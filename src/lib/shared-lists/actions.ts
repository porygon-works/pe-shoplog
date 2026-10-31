"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { isUuid } from "@/lib/ids";
import { LIST_NAME_MAX, normalizeListName } from "@/lib/lists/shared";
import { createServerClient } from "@/lib/supabase/server";
import { requestOrigin } from "./origin";
import {
  SHARED_DESCRIPTION_MAX,
  SHARED_NOTE_MAX,
  type SharedPickerList,
  inviteUrlOf,
  normalizeDescription,
  normalizeNote,
} from "./shared";

const SERVER_ERROR = "保存に失敗しました。時間をおいてもう一度お試しください";
const NAME_ERROR = `リスト名は1〜${LIST_NAME_MAX}文字で入力してください`;
const DESC_ERROR = `説明は${SHARED_DESCRIPTION_MAX}文字までで入力してください`;
const BAD_ID = "リストの情報が正しくありません";

export type ActionError = { error: string };

export async function createSharedListAction(input: {
  name: string;
  description?: string;
  isPublic: boolean;
}): Promise<{ id: string } | ActionError> {
  const user = await requireUser();
  const name = normalizeListName(input?.name);
  if (!name) return { error: NAME_ERROR };
  const description = normalizeDescription(input?.description);
  if (description === undefined) return { error: DESC_ERROR };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("shared_lists")
    .insert({ owner_id: user.id, name, description, is_public: input.isPublic === true })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createSharedList failed", error);
    return { error: SERVER_ERROR };
  }
  revalidatePath("/me");
  return { id: data.id as string };
}

export async function updateSharedListAction(
  listId: string,
  patch: { name?: string; description?: string; isPublic?: boolean },
): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(listId)) return { error: BAD_ID };
  const update: { name?: string; description?: string | null; is_public?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) {
    const name = normalizeListName(patch.name);
    if (!name) return { error: NAME_ERROR };
    update.name = name;
  }
  if (patch.description !== undefined) {
    const description = normalizeDescription(patch.description);
    if (description === undefined) return { error: DESC_ERROR };
    update.description = description;
  }
  if (patch.isPublic !== undefined) update.is_public = patch.isPublic === true;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("shared_lists")
    .update(update)
    .eq("id", listId)
    .eq("owner_id", user.id)
    .select("id");
  if (error) {
    console.error("updateSharedList failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "リストが見つからないか、変更できるのはオーナーだけです" };
  revalidatePath(`/shared/${listId}`);
  revalidatePath("/me");
  return { ok: true };
}

export async function deleteSharedListAction(listId: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(listId)) return { error: BAD_ID };
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("shared_lists")
    .delete()
    .eq("id", listId)
    .eq("owner_id", user.id)
    .select("id");
  if (error) {
    console.error("deleteSharedList failed", error);
    return { error: "削除に失敗しました。時間をおいてもう一度お試しください" };
  }
  if (!data || data.length === 0) return { error: "リストが見つからないか、削除できるのはオーナーだけです" };
  revalidatePath("/me");
  return { ok: true };
}

/** オーナーが他のメンバーを外す、または本人が抜ける。オーナー自身は抜けられない。 */
export async function removeMemberAction(listId: string, userId: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(listId) || !isUuid(userId)) return { error: BAD_ID };

  const supabase = await createServerClient();
  const { data: mine, error: mineError } = await supabase
    .from("shared_list_members")
    .select("role")
    .eq("shared_list_id", listId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (mineError) {
    console.error("removeMember lookup failed", mineError);
    return { error: SERVER_ERROR };
  }
  if (!mine) return { error: "このリストのメンバーではありません" };
  if (userId !== user.id && mine.role !== "owner") return { error: "メンバーを外せるのはオーナーだけです" };

  const { data: target, error: targetError } = await supabase
    .from("shared_list_members")
    .select("role")
    .eq("shared_list_id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (targetError) {
    console.error("removeMember target lookup failed", targetError);
    return { error: SERVER_ERROR };
  }
  if (!target) return { error: "メンバーが見つかりませんでした" };
  if (target.role === "owner") return { error: "オーナーはリストから抜けられません" };

  const { data, error } = await supabase
    .from("shared_list_members")
    .delete()
    .eq("shared_list_id", listId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    console.error("removeMember failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "メンバーを外せませんでした" };
  revalidatePath(`/shared/${listId}`);
  revalidatePath("/me");
  return { ok: true };
}

/** 招待リンクを作り直す。古いリンクは使えなくなる。 */
export async function regenerateInviteAction(
  listId: string,
): Promise<{ token: string; url: string } | ActionError> {
  await requireUser();
  if (!isUuid(listId)) return { error: BAD_ID };
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("regenerate_invite_token", { p_list: listId });
  if (error || typeof data !== "string") {
    console.error("regenerateInvite failed", error);
    return {
      error: error?.code === "42501" ? "リンクを作り直せるのはオーナーだけです" : SERVER_ERROR,
    };
  }
  revalidatePath(`/shared/${listId}`);
  return { token: data, url: inviteUrlOf(await requestOrigin(), data) };
}

/** 招待リンクから参加する。 */
export async function joinSharedListAction(token: string): Promise<{ id: string } | ActionError> {
  await requireUser();
  if (typeof token !== "string" || token.length === 0 || token.length > 200) {
    return { error: "この招待リンクは無効です" };
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("join_shared_list", { p_token: token });
  if (error || typeof data !== "string") {
    if (error?.message?.includes("invalid_invite")) return { error: "この招待リンクは無効です" };
    console.error("joinSharedList failed", error);
    return { error: "参加できませんでした。時間をおいてもう一度お試しください" };
  }
  revalidatePath("/me");
  return { id: data };
}

/** リスト選択シートに出す、自分が参加している共有リストと「この店が入っているか」。 */
export async function sharedPickerDataAction(
  shopId: string,
): Promise<{ lists: SharedPickerList[] } | ActionError> {
  const user = await requireUser();
  if (!isUuid(shopId)) return { error: "店の情報が正しくありません" };
  const supabase = await createServerClient();
  const { data: memberships, error } = await supabase
    .from("shared_list_members")
    .select("shared_list_id, shared_lists(id, name)")
    .eq("user_id", user.id);
  if (error) {
    console.error("sharedPickerData failed", error);
    return { error: "共有リストを読み込めませんでした。時間をおいてもう一度お試しください" };
  }
  type M = { shared_list_id: string; shared_lists: { id: string; name: string } | { id: string; name: string }[] | null };
  const rows = ((memberships ?? []) as unknown as M[]).flatMap((m) => {
    const l = Array.isArray(m.shared_lists) ? m.shared_lists[0] : m.shared_lists;
    return l ? [l] : [];
  });
  if (rows.length === 0) return { lists: [] };
  const ids = rows.map((r) => r.id);

  const [items, members] = await Promise.all([
    supabase.from("shared_list_items").select("shared_list_id, note").eq("shop_id", shopId).in("shared_list_id", ids),
    supabase.from("shared_list_members").select("shared_list_id").in("shared_list_id", ids).limit(10000),
  ]);
  if (items.error || members.error) {
    console.error("sharedPickerData failed", items.error ?? members.error);
    return { error: "共有リストを読み込めませんでした。時間をおいてもう一度お試しください" };
  }
  const noteOf = new Map<string, string>();
  for (const i of items.data ?? []) noteOf.set(i.shared_list_id as string, (i.note as string | null) ?? "");
  const counts = new Map<string, number>();
  for (const m of members.data ?? []) counts.set(m.shared_list_id as string, (counts.get(m.shared_list_id as string) ?? 0) + 1);

  return {
    lists: rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        memberCount: counts.get(r.id) ?? 1,
        included: noteOf.has(r.id),
        note: noteOf.get(r.id) ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
  };
}

/** 共有リストに店を入れる（メモ付き可）・外す。入っている店にメモだけ付け直すこともできる。 */
export async function setSharedListItemAction(
  listId: string,
  shopId: string,
  included: boolean,
  note?: string,
): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(listId) || !isUuid(shopId)) return { error: "リストまたは店の情報が正しくありません" };
  const noteValue = normalizeNote(note);
  if (noteValue === undefined) return { error: `メモは${SHARED_NOTE_MAX}文字までで入力してください` };

  const supabase = await createServerClient();
  const { data: member, error: memberError } = await supabase
    .from("shared_list_members")
    .select("user_id")
    .eq("shared_list_id", listId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError) {
    console.error("setSharedListItem member lookup failed", memberError);
    return { error: SERVER_ERROR };
  }
  if (!member) return { error: "このリストのメンバーではありません" };

  if (included) {
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("id", shopId)
      .is("deleted_at", null)
      .maybeSingle();
    if (shopError) {
      console.error("setSharedListItem shop lookup failed", shopError);
      return { error: SERVER_ERROR };
    }
    if (!shop) return { error: "店が見つかりませんでした" };

    const updateNote = async () => {
      const { data, error } = await supabase
        .from("shared_list_items")
        .update({ note: noteValue })
        .eq("shared_list_id", listId)
        .eq("shop_id", shopId)
        .select("shop_id");
      return { rows: data?.length ?? 0, error };
    };
    const existing = await updateNote();
    if (existing.error) {
      console.error("setSharedListItem update failed", existing.error);
      return { error: SERVER_ERROR };
    }
    if (existing.rows === 0) {
      const { error } = await supabase
        .from("shared_list_items")
        .insert({ shared_list_id: listId, shop_id: shopId, added_by: user.id, note: noteValue });
      if (error && error.code !== "23505") {
        console.error("setSharedListItem insert failed", error);
        return { error: SERVER_ERROR };
      }
      if (error) {
        // 同時に別の人が入れた。メモだけ付け直す。
        const retry = await updateNote();
        if (retry.error || retry.rows === 0) return { error: SERVER_ERROR };
      }
    }
  } else {
    const { error } = await supabase
      .from("shared_list_items")
      .delete()
      .eq("shared_list_id", listId)
      .eq("shop_id", shopId);
    if (error) {
      console.error("setSharedListItem delete failed", error);
      return { error: SERVER_ERROR };
    }
  }
  revalidatePath(`/shared/${listId}`);
  revalidatePath("/me");
  return { ok: true };
}
