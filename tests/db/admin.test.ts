import { beforeAll, describe, expect, it } from "vitest";
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
import { hashPassphrase } from "@/lib/auth/passphrase";
import { registerUser } from "@/lib/auth/signup";
import { toAuthEmail } from "@/lib/auth/login-id";
import {
  TEST_PASSWORD,
  adminClient,
  anonClient,
  createShop,
  createTestUser,
  createVisit,
  uniqueId,
} from "./helpers";

const admin = adminClient();

function ip() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

async function newAdmin() {
  return createTestUser(uniqueId("ad"), { admin: true });
}
async function newMember() {
  return createTestUser(uniqueId("mb"));
}

beforeAll(async () => {
  const { error } = await admin.from("app_settings").upsert({
    key: "signup_passphrase_hash",
    value: await hashPassphrase("pe"),
  });
  if (error) throw error;
});

describe("管理者でない操作者は拒否される", () => {
  it("setPassphrase", async () => {
    const m = await newMember();
    const before = await admin.from("app_settings").select("value").eq("key", "signup_passphrase_hash").single();
    const res = await setPassphrase(m.id, "zz");
    expect(res).toEqual({ ok: false, error: "forbidden" });
    const after = await admin.from("app_settings").select("value").eq("key", "signup_passphrase_hash").single();
    expect(after.data?.value).toBe(before.data?.value);
  });

  it("他の操作も同様（対象には何も起きない）", async () => {
    const m = await newMember();
    const target = await newMember();
    const shop = await createShop(target.id);
    expect(await disableUser(m.id, target.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await grantAdmin(m.id, target.id, true)).toEqual({ ok: false, error: "forbidden" });
    expect(await issueTempPassword(m.id, target.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await softDeleteShop(m.id, shop)).toEqual({ ok: false, error: "forbidden" });
    expect(await deleteUser(m.id, target.id)).toEqual({ ok: false, error: "forbidden" });
    const p = await admin.from("profiles").select("is_admin, disabled_at").eq("id", target.id).single();
    expect(p.data).toEqual({ is_admin: false, disabled_at: null });
    const s = await admin.from("shops").select("deleted_at").eq("id", shop).single();
    expect(s.data?.deleted_at).toBeNull();
  });

  it("停止中の管理者・存在しない操作者も拒否される", async () => {
    const a = await newAdmin();
    await admin.from("profiles").update({ disabled_at: new Date().toISOString() }).eq("id", a.id);
    const t = await newMember();
    expect(await disableUser(a.id, t.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await disableUser("00000000-0000-4000-8000-000000000000", t.id)).toEqual({
      ok: false,
      error: "forbidden",
    });
  });
});

describe("合言葉の変更", () => {
  it("変更後は古い合言葉での registerUser が bad_passphrase、新しい合言葉なら通る", async () => {
    const a = await newAdmin();
    const res = await setPassphrase(a.id, "  Zq ");
    expect(res).toEqual({ ok: true });
    const input = (passphrase: string) => ({
      loginId: uniqueId("r"),
      nickname: "太郎",
      password: "password-1234",
      passphrase,
    });
    expect(await registerUser(input("pe"), ip())).toEqual({ ok: false, error: "bad_passphrase" });
    expect((await registerUser(input("ZQ"), ip())).ok).toBe(true);
    // 後続のテストのために戻す
    expect(await setPassphrase(a.id, "pe")).toEqual({ ok: true });
  });

  it("1 文字（trim 後）は invalid で何も変えない", async () => {
    const a = await newAdmin();
    expect(await setPassphrase(a.id, " x ")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("停止・再開", () => {
  it("停止したユーザーはパスワードでログインできず、再開すると入れる", async () => {
    const a = await newAdmin();
    const loginId = uniqueId("dis");
    const t = await createTestUser(loginId);
    expect(await disableUser(a.id, t.id)).toEqual({ ok: true });

    const p = await admin.from("profiles").select("disabled_at").eq("id", t.id).single();
    expect(p.data?.disabled_at).not.toBeNull();

    const blocked = await anonClient().auth.signInWithPassword({
      email: toAuthEmail(loginId),
      password: TEST_PASSWORD,
    });
    expect(blocked.error).not.toBeNull();

    expect(await enableUser(a.id, t.id)).toEqual({ ok: true });
    const ok = await anonClient().auth.signInWithPassword({
      email: toAuthEmail(loginId),
      password: TEST_PASSWORD,
    });
    expect(ok.error).toBeNull();
  });

  it("自分自身は停止・削除・管理者解除できない", async () => {
    const a = await newAdmin();
    expect((await disableUser(a.id, a.id)).ok).toBe(false);
    expect((await deleteUser(a.id, a.id)).ok).toBe(false);
    expect((await grantAdmin(a.id, a.id, false)).ok).toBe(false);
    const p = await admin.from("profiles").select("is_admin, disabled_at").eq("id", a.id).single();
    expect(p.data).toEqual({ is_admin: true, disabled_at: null });
  });

  it("存在しない対象は not_found", async () => {
    const a = await newAdmin();
    const ghost = "00000000-0000-4000-8000-000000000001";
    expect(await disableUser(a.id, ghost)).toEqual({ ok: false, error: "not_found" });
    expect(await enableUser(a.id, ghost)).toEqual({ ok: false, error: "not_found" });
    expect(await deleteUser(a.id, ghost)).toEqual({ ok: false, error: "not_found" });
    expect(await grantAdmin(a.id, ghost, true)).toEqual({ ok: false, error: "not_found" });
    expect(await issueTempPassword(a.id, ghost)).toEqual({ ok: false, error: "not_found" });
    expect(await softDeleteShop(a.id, ghost)).toEqual({ ok: false, error: "not_found" });
    expect(await softDeleteVisit(a.id, ghost)).toEqual({ ok: false, error: "not_found" });
    expect(await deletePhoto(a.id, ghost)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("管理者権限・仮パスワード", () => {
  it("grantAdmin で付与・解除できる", async () => {
    const a = await newAdmin();
    const t = await newMember();
    expect(await grantAdmin(a.id, t.id, true)).toEqual({ ok: true });
    expect((await admin.from("profiles").select("is_admin").eq("id", t.id).single()).data?.is_admin).toBe(true);
    expect(await grantAdmin(a.id, t.id, false)).toEqual({ ok: true });
    expect((await admin.from("profiles").select("is_admin").eq("id", t.id).single()).data?.is_admin).toBe(false);
  });

  it("仮パスワードでログインできる", async () => {
    const a = await newAdmin();
    const loginId = uniqueId("tmp");
    const t = await createTestUser(loginId);
    const res = await issueTempPassword(a.id, t.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tempPassword).toHaveLength(12);
    const signIn = await anonClient().auth.signInWithPassword({
      email: toAuthEmail(loginId),
      password: res.tempPassword,
    });
    expect(signIn.error).toBeNull();
  });
});

describe("ユーザー削除", () => {
  it("visit は残り user_id が null になる", async () => {
    const a = await newAdmin();
    const t = await newMember();
    const shop = await createShop(t.id);
    const visit = await createVisit(shop, t.id);
    expect(await deleteUser(a.id, t.id)).toEqual({ ok: true });
    const v = await admin.from("visits").select("user_id, deleted_at").eq("id", visit).single();
    expect(v.data).toEqual({ user_id: null, deleted_at: null });
    const p = await admin.from("profiles").select("id").eq("id", t.id);
    expect(p.data).toEqual([]);
  });
});

describe("論理削除", () => {
  it("店・記録（写真ごと）・写真を論理削除する", async () => {
    const a = await newAdmin();
    const u = await newMember();
    const shop = await createShop(u.id);
    const visit = await createVisit(shop, u.id);
    const photoRow = (i: number) => ({
      visit_id: visit,
      shop_id: shop,
      user_id: u.id,
      kind: "food",
      storage_path: `shops/${shop}/visits/${visit}/${crypto.randomUUID()}-${i}.jpg`,
      width: 10,
      height: 10,
    });
    const ins = await admin.from("photos").insert([photoRow(1), photoRow(2)]).select("id");
    expect(ins.error).toBeNull();
    const [p1] = ins.data!;

    expect((await deletePhoto(a.id, p1.id)).ok).toBe(true);
    expect((await admin.from("photos").select("deleted_at").eq("id", p1.id).single()).data?.deleted_at).not.toBeNull();

    expect((await softDeleteVisit(a.id, visit)).ok).toBe(true);
    const photos = await admin.from("photos").select("deleted_at").eq("visit_id", visit);
    expect(photos.data!.every((p) => p.deleted_at !== null)).toBe(true);
    expect((await admin.from("visits").select("deleted_at").eq("id", visit).single()).data?.deleted_at).not.toBeNull();
    // 二重削除は not_found
    expect(await softDeleteVisit(a.id, visit)).toMatchObject({ ok: false, error: "not_found" });

    expect(await softDeleteShop(a.id, shop)).toEqual({ ok: true });
    expect((await admin.from("shops").select("deleted_at").eq("id", shop).single()).data?.deleted_at).not.toBeNull();
  });
});
