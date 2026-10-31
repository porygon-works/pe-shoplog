import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPassphrase } from "@/lib/auth/passphrase";
import { PASSPHRASE_SETTING_KEY } from "@/lib/auth/signup";
import { isUuid } from "@/lib/ids";
import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_PASSPHRASE_LENGTH } from "./constants";
import type { AdminError, AdminResult } from "./messages";
import { generateTempPassword } from "./temp-password";

/**
 * 管理操作の本体。secret キーで動くので、各関数が最初に操作者（actorId）が
 * 有効な管理者かを自分で確認する。Server Action 側の確認には頼らない。
 */

const BAN_FOREVER = "876000h";

type Db = SupabaseClient;
const fail = (error: AdminError): { ok: false; error: AdminError } => ({ ok: false, error });

async function isLiveAdmin(db: Db, actorId: string): Promise<boolean> {
  if (!isUuid(actorId)) return false;
  const { data, error } = await db
    .from("profiles")
    .select("is_admin, disabled_at")
    .eq("id", actorId)
    .maybeSingle();
  if (error) throw error;
  return !!data && data.is_admin === true && data.disabled_at === null;
}

/** 権限確認 → 本体。例外は握りつぶさずログに残し server_error にする。 */
async function guarded<T extends { ok: boolean }>(
  actorId: string,
  name: string,
  body: (db: Db) => Promise<T | { ok: false; error: AdminError }>,
  db: Db,
): Promise<T | { ok: false; error: AdminError }> {
  try {
    if (!(await isLiveAdmin(db, actorId))) return fail("forbidden");
    return await body(db);
  } catch (e) {
    console.error(`admin ${name} failed`, e);
    return fail("server_error");
  }
}

async function profileExists(db: Db, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const { data, error } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function setPassphrase(
  actorId: string,
  passphrase: string,
  db: Db = createAdminClient(),
): Promise<AdminResult> {
  return guarded(
    actorId,
    "setPassphrase",
    async () => {
      const trimmed = typeof passphrase === "string" ? passphrase.trim() : "";
      if ([...trimmed].length < MIN_PASSPHRASE_LENGTH) return fail("invalid");
      const { error } = await db
        .from("app_settings")
        .upsert({ key: PASSPHRASE_SETTING_KEY, value: await hashPassphrase(trimmed) });
      if (error) throw error;
      return { ok: true } as const;
    },
    db,
  );
}

export async function issueTempPassword(
  actorId: string,
  userId: string,
  db: Db = createAdminClient(),
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: AdminError }> {
  return guarded(
    actorId,
    "issueTempPassword",
    async () => {
      if (!(await profileExists(db, userId))) return fail("not_found");
      const tempPassword = generateTempPassword();
      const { error } = await db.auth.admin.updateUserById(userId, { password: tempPassword });
      if (error) throw error;
      return { ok: true, tempPassword } as const;
    },
    db,
  );
}

export async function disableUser(
  actorId: string,
  userId: string,
  db: Db = createAdminClient(),
): Promise<AdminResult> {
  return guarded(
    actorId,
    "disableUser",
    async () => {
      if (userId === actorId) return fail("self");
      if (!(await profileExists(db, userId))) return fail("not_found");
      const upd = await db
        .from("profiles")
        .update({ disabled_at: new Date().toISOString() })
        .eq("id", userId);
      if (upd.error) throw upd.error;
      const ban = await db.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER });
      if (ban.error) {
        // BAN できなかったら停止状態を戻し、中途半端な状態を残さない。
        await db.from("profiles").update({ disabled_at: null }).eq("id", userId);
        throw ban.error;
      }
      return { ok: true } as const;
    },
    db,
  );
}

export async function enableUser(
  actorId: string,
  userId: string,
  db: Db = createAdminClient(),
): Promise<AdminResult> {
  return guarded(
    actorId,
    "enableUser",
    async () => {
      if (!(await profileExists(db, userId))) return fail("not_found");
      const unban = await db.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (unban.error) throw unban.error;
      const upd = await db.from("profiles").update({ disabled_at: null }).eq("id", userId);
      if (upd.error) throw upd.error;
      return { ok: true } as const;
    },
    db,
  );
}

export async function deleteUser(
  actorId: string,
  userId: string,
  db: Db = createAdminClient(),
): Promise<AdminResult> {
  return guarded(
    actorId,
    "deleteUser",
    async () => {
      if (userId === actorId) return fail("self");
      if (!(await profileExists(db, userId))) return fail("not_found");
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw error;
      return { ok: true } as const;
    },
    db,
  );
}

export async function grantAdmin(
  actorId: string,
  userId: string,
  on: boolean,
  db: Db = createAdminClient(),
): Promise<AdminResult> {
  return guarded(
    actorId,
    "grantAdmin",
    async () => {
      if (userId === actorId) return fail("self");
      if (!(await profileExists(db, userId))) return fail("not_found");
      const { error } = await db.from("profiles").update({ is_admin: on === true }).eq("id", userId);
      if (error) throw error;
      return { ok: true } as const;
    },
    db,
  );
}

export async function softDeleteShop(
  actorId: string,
  shopId: string,
  db: Db = createAdminClient(),
): Promise<AdminResult> {
  return guarded(
    actorId,
    "softDeleteShop",
    async () => {
      if (!isUuid(shopId)) return fail("not_found");
      const { data, error } = await db
        .from("shops")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", shopId)
        .is("deleted_at", null)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) return fail("not_found");
      return { ok: true } as const;
    },
    db,
  );
}

/** 記録を論理削除し、その写真もまとめて論理削除する（投稿者本人の削除と同じ）。 */
export async function softDeleteVisit(
  actorId: string,
  visitId: string,
  db: Db = createAdminClient(),
): Promise<AdminResult & { shopId?: string }> {
  return guarded(
    actorId,
    "softDeleteVisit",
    async () => {
      if (!isUuid(visitId)) return fail("not_found");
      const now = new Date().toISOString();
      const { data, error } = await db
        .from("visits")
        .update({ deleted_at: now })
        .eq("id", visitId)
        .is("deleted_at", null)
        .select("id, shop_id");
      if (error) throw error;
      if (!data || data.length === 0) return fail("not_found");
      const photos = await db
        .from("photos")
        .update({ deleted_at: now })
        .eq("visit_id", visitId)
        .is("deleted_at", null);
      if (photos.error) throw photos.error;
      return { ok: true, shopId: data[0].shop_id as string } as const;
    },
    db,
  );
}

export async function deletePhoto(
  actorId: string,
  photoId: string,
  db: Db = createAdminClient(),
): Promise<AdminResult & { shopId?: string }> {
  return guarded(
    actorId,
    "deletePhoto",
    async () => {
      if (!isUuid(photoId)) return fail("not_found");
      const { data, error } = await db
        .from("photos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", photoId)
        .is("deleted_at", null)
        .select("id, shop_id, storage_path");
      if (error) throw error;
      if (!data || data.length === 0) return fail("not_found");
      // 実体の削除は後始末。失敗しても記録上は削除済みなのでログだけ残す。
      const rm = await db.storage.from("photos").remove([data[0].storage_path]);
      if (rm.error) console.error("admin deletePhoto storage remove failed", rm.error);
      return { ok: true, shopId: data[0].shop_id as string } as const;
    },
    db,
  );
}
