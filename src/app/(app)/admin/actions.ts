"use server";

import { revalidatePath } from "next/cache";
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
  const res = toOut(await softDeleteShop(user.id, shopId));
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
