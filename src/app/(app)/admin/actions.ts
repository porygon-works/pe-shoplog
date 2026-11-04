"use server";

import { revalidatePath } from "next/cache";
import { logResult } from "@/lib/log/server";
import {
  deletePhoto,
  deleteUser,
  disableUser,
  enableUser,
  grantAdmin,
  issueTempPassword,
  setPassphrase,
  softDeleteShop,
  softDeleteVisit,
} from "@/lib/admin/actions";
import { adminErrorMessage, type AdminError } from "@/lib/admin/messages";
import { requireAdmin } from "@/lib/auth/current-user";
import { createRefreshDeps, refreshStaleLocations } from "@/lib/places/refresh-locations";

/**
 * 薄いラッパー。ここでも requireAdmin() を呼ぶが、権限確認の本体は
 * `@/lib/admin/actions` 側（各関数が自分で再確認する）。
 */
type Out = { ok: true } | { error: string };

function toOut(res: { ok: true } | { ok: false; error: AdminError }): Out {
  return res.ok ? { ok: true } : { error: adminErrorMessage(res.error) };
}

export async function setPassphraseAction(passphrase: string): Promise<Out> {
  const user = await requireAdmin();
  return toOut(await setPassphrase(user.id, passphrase));
}

export async function issueTempPasswordAction(
  userId: string,
): Promise<{ tempPassword: string } | { error: string }> {
  const user = await requireAdmin();
  const res = await issueTempPassword(user.id, userId);
  return res.ok ? { tempPassword: res.tempPassword } : { error: adminErrorMessage(res.error) };
}

export async function disableUserAction(userId: string): Promise<Out> {
  const user = await requireAdmin();
  const res = toOut(await disableUser(user.id, userId));
  revalidatePath("/admin");
  return res;
}

export async function enableUserAction(userId: string): Promise<Out> {
  const user = await requireAdmin();
  const res = toOut(await enableUser(user.id, userId));
  revalidatePath("/admin");
  return res;
}

export async function deleteUserAction(userId: string): Promise<Out> {
  const user = await requireAdmin();
  const res = toOut(await deleteUser(user.id, userId));
  revalidatePath("/admin");
  return res;
}

export async function grantAdminAction(userId: string, on: boolean): Promise<Out> {
  const user = await requireAdmin();
  const res = toOut(await grantAdmin(user.id, userId, on));
  revalidatePath("/admin");
  return res;
}

export async function softDeleteShopAction(shopId: string): Promise<Out> {
  const user = await requireAdmin();
  const res = logResult("shop_delete", toOut(await softDeleteShop(user.id, shopId)), { shopId });
  if ("ok" in res) revalidatePath(`/shops/${shopId}`);
  return res;
}

export async function softDeleteVisitAction(visitId: string): Promise<Out> {
  const user = await requireAdmin();
  const res = await softDeleteVisit(user.id, visitId);
  if (res.ok && res.shopId) revalidatePath(`/shops/${res.shopId}`);
  return toOut(res);
}

export async function deletePhotoAction(photoId: string): Promise<Out> {
  const user = await requireAdmin();
  const res = await deletePhoto(user.id, photoId);
  if (res.ok && res.shopId) revalidatePath(`/shops/${res.shopId}`);
  return toOut(res);
}

/** place_id のある全店の位置を Google の店の位置で取り直す（住所から取った位置のずれを直す）。 */
export async function refreshAllLocationsAction(): Promise<{ updated: number; failed: number } | { error: string }> {
  await requireAdmin();
  try {
    const res = await refreshStaleLocations(createRefreshDeps({ all: true }), 200);
    revalidatePath("/", "layout");
    return res;
  } catch (e) {
    console.error("refreshAllLocations failed", e);
    return { error: "位置を取り直せませんでした。時間をおいてもう一度お試しください" };
  }
}
