"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";
import { isUuid } from "@/lib/ids";
import { PHOTO_KINDS, values } from "@/lib/options";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { visitInputSchema } from "@/lib/validation";

const SERVER_ERROR = "保存に失敗しました。時間をおいてもう一度お試しください";
const MAX_PHOTOS = 10;

export type ActionError = { error: string };

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function parseVisit(formData: FormData) {
  const rawSize = text(formData, "partySize").trim();
  const partySize = rawSize === "" ? null : /^\d+$/.test(rawSize) ? Number(rawSize) : Number.NaN;
  const rawRating = text(formData, "rating").trim();
  const rating = rawRating === "" ? null : /^\d$/.test(rawRating) ? Number(rawRating) : Number.NaN;
  const parsed = visitInputSchema.safeParse({
    visitedOn: text(formData, "visitedOn").trim() || null,
    rating,
    partySize,
    comment: text(formData, "comment"),
    priceRange: text(formData, "priceRange") || "unknown",
    purpose: text(formData, "purpose") || "unknown",
    reservation: text(formData, "reservation") || "unknown",
    paymentMethods: formData.getAll("paymentMethods").map(String),
  });
  if (parsed.success) return { data: parsed.data };
  const field = parsed.error.issues[0]?.path[0];
  const message =
    field === "visitedOn"
      ? "行った日を正しく入力してください"
      : field === "rating"
        ? "評価は ★1〜5 で選んでください"
        : field === "partySize"
          ? "人数は 1〜500 の整数で入力してください"
          : field === "comment"
            ? "コメントは1,000文字までです"
            : "入力内容を確認してください";
  return { error: message };
}

const PURPOSE_ERROR = "選べない用途です。画面を開き直してもう一度お試しください";
const CHECK_VIOLATION = "23514";

/** 用途が区分にあるか。新しく記録するときは非表示の用途は選べない（編集では元の値を保てるよう許す）。 */
async function invalidPurpose(purpose: string, allowHidden: boolean): Promise<boolean> {
  if (purpose === "unknown") return false;
  const c = (await getCategories()).purposes.find((p) => p.value === purpose);
  return !c || (c.hidden && !allowHidden);
}

function visitColumns(d: NonNullable<ReturnType<typeof parseVisit>["data"]>) {
  return {
    visited_on: d.visitedOn,
    rating: d.rating,
    price_range: d.priceRange,
    purpose: d.purpose,
    party_size: d.partySize,
    reservation: d.reservation,
    payment_methods: d.paymentMethods,
    comment: d.comment === "" ? null : d.comment,
  };
}

export async function createVisitAction(
  shopId: string,
  formData: FormData,
): Promise<{ visitId: string } | ActionError> {
  const user = await requireUser();
  if (!isUuid(shopId)) return { error: "店の情報が正しくありません" };
  const parsed = parseVisit(formData);
  if (!parsed.data) return { error: parsed.error! };
  if (await invalidPurpose(parsed.data.purpose, false)) return { error: PURPOSE_ERROR };

  const supabase = await createServerClient();
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .is("deleted_at", null)
    .maybeSingle();
  if (shopError) {
    console.error("createVisit shop lookup failed", shopError);
    return { error: SERVER_ERROR };
  }
  if (!shop) return { error: "店が見つかりませんでした" };

  const { data, error } = await supabase
    .from("visits")
    .insert({ shop_id: shopId, user_id: user.id, ...visitColumns(parsed.data) })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createVisit failed", error);
    if (error?.code === CHECK_VIOLATION) return { error: PURPOSE_ERROR };
    return { error: SERVER_ERROR };
  }
  revalidatePath(`/shops/${shopId}`);
  return { visitId: data.id as string };
}

export async function updateVisitAction(
  visitId: string,
  formData: FormData,
): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(visitId)) return { error: "記録の情報が正しくありません" };
  const parsed = parseVisit(formData);
  if (!parsed.data) return { error: parsed.error! };
  if (await invalidPurpose(parsed.data.purpose, true)) return { error: PURPOSE_ERROR };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("visits")
    .update(visitColumns(parsed.data))
    .eq("id", visitId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id, shop_id");
  if (error) {
    console.error("updateVisit failed", error);
    if (error.code === CHECK_VIOLATION) return { error: PURPOSE_ERROR };
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "記録が見つかりませんでした" };
  revalidatePath(`/shops/${data[0].shop_id}`);
  return { ok: true };
}

/** 論理削除。写真もまとめて論理削除する。 */
export async function deleteVisitAction(visitId: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(visitId)) return { error: "記録の情報が正しくありません" };

  const supabase = await createServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("visits")
    .update({ deleted_at: now })
    .eq("id", visitId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id, shop_id");
  if (error) {
    console.error("deleteVisit failed", error);
    return { error: "削除に失敗しました。時間をおいてもう一度お試しください" };
  }
  if (!data || data.length === 0) return { error: "記録が見つかりませんでした" };

  const { error: photoError } = await supabase
    .from("photos")
    .update({ deleted_at: now })
    .eq("visit_id", visitId)
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (photoError) {
    console.error("deleteVisit photos failed", photoError);
    return { error: "写真の削除に失敗しました。もう一度お試しください" };
  }
  revalidatePath(`/shops/${data[0].shop_id}`);
  return { ok: true };
}

export type AddPhotoInput = {
  visitId: string;
  shopId: string;
  kind: string;
  storagePath: string;
  width: number;
  height: number;
};

const FILE_PART = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg";
const KINDS: readonly string[] = values(PHOTO_KINDS);

export async function addPhotoAction(
  input: AddPhotoInput,
): Promise<{ photoId: string } | ActionError> {
  const user = await requireUser();
  const { visitId, shopId, kind, storagePath, width, height } = input;
  if (!isUuid(visitId) || !isUuid(shopId)) return { error: "記録の情報が正しくありません" };
  if (!KINDS.includes(kind)) return { error: "写真の種類が正しくありません" };
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { error: "写真のサイズが正しくありません" };
  }
  const prefix = `shops/${shopId}/visits/${visitId}/`;
  if (
    typeof storagePath !== "string" ||
    !storagePath.startsWith(prefix) ||
    !new RegExp(`^${FILE_PART}$`, "i").test(storagePath.slice(prefix.length))
  ) {
    return { error: "写真の保存先が正しくありません" };
  }

  const supabase = await createServerClient();
  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("id")
    .eq("id", visitId)
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (visitError) {
    console.error("addPhoto visit lookup failed", visitError);
    return { error: SERVER_ERROR };
  }
  if (!visit) return { error: "記録が見つかりませんでした" };

  const { count, error: countError } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("visit_id", visitId)
    .is("deleted_at", null);
  if (countError) {
    console.error("addPhoto count failed", countError);
    return { error: SERVER_ERROR };
  }
  if ((count ?? 0) >= MAX_PHOTOS) return { error: "写真は1つの記録に10枚までです" };

  const { data, error } = await supabase
    .from("photos")
    .insert({
      visit_id: visitId,
      shop_id: shopId,
      user_id: user.id,
      kind,
      storage_path: storagePath,
      width,
      height,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("addPhoto failed", error);
    return { error: SERVER_ERROR };
  }
  revalidatePath(`/shops/${shopId}`);
  return { photoId: data.id as string };
}

export async function updatePhotoKindAction(
  photoId: string,
  kind: string,
): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(photoId)) return { error: "写真の情報が正しくありません" };
  if (!KINDS.includes(kind)) return { error: "写真の種類が正しくありません" };
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("photos")
    .update({ kind })
    .eq("id", photoId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id, shop_id");
  if (error) {
    console.error("updatePhotoKind failed", error);
    return { error: SERVER_ERROR };
  }
  if (!data || data.length === 0) return { error: "写真が見つかりませんでした" };
  revalidatePath(`/shops/${data[0].shop_id}`);
  return { ok: true };
}

export async function deletePhotoAction(photoId: string): Promise<{ ok: true } | ActionError> {
  const user = await requireUser();
  if (!isUuid(photoId)) return { error: "写真の情報が正しくありません" };
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", photoId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id, shop_id, storage_path");
  if (error) {
    console.error("deletePhoto failed", error);
    return { error: "削除に失敗しました。時間をおいてもう一度お試しください" };
  }
  if (!data || data.length === 0) return { error: "写真が見つかりませんでした" };
  // 実体の削除は後始末。論理削除の時点で本人の Storage ポリシー（生きている写真行が必要）からは
  // 見えなくなるため、権限確認が済んだ後に admin で消す。失敗しても記録上は削除済みなので記録だけ残す。
  const { error: rmError } = await createAdminClient()
    .storage.from("photos")
    .remove([data[0].storage_path]);
  if (rmError) console.error("deletePhoto storage remove failed", rmError);
  revalidatePath(`/shops/${data[0].shop_id}`);
  return { ok: true };
}
