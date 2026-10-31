import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  AUTH_EMAIL_DOMAIN,
  createShop,
  createTestUser,
  createVisit,
  uniqueId,
} from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

type U = { id: string; client: SupabaseClient };
let a: U, b: U, c: U;

beforeAll(async () => {
  a = await createTestUser(uniqueId("a"));
  b = await createTestUser(uniqueId("b"));
  c = await createTestUser(uniqueId("c"), { admin: true });
});

describe("認証設定", () => {
  it("公開サインアップは失敗する", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: `${uniqueId("s")}@${AUTH_EMAIL_DOMAIN}`,
      password: "test-password-1234",
    });
    expect(error?.code).toBe("signup_disabled");
    expect(data.user).toBeNull();
  });

  it("ダミードメインのアドレスで admin.createUser できる", async () => {
    const { data, error } = await adminClient().auth.admin.createUser({
      email: `${uniqueId("d")}@${AUTH_EMAIL_DOMAIN}`,
      password: "test-password-1234",
      email_confirm: true,
    });
    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();
  });
});

describe("shops", () => {
  it("未ログインでは 0 件", async () => {
    await createShop(a.id);
    const { data, error } = await anonClient().from("shops").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("ログインユーザーは削除されていない店だけ読める", async () => {
    const live = await createShop(a.id);
    const dead = await createShop(a.id, { deleted_at: new Date().toISOString() });
    const { data } = await b.client.from("shops").select("id");
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(live);
    expect(ids).not.toContain(dead);
  });

  it("A は name を更新できる", async () => {
    const shop = await createShop(b.id);
    const { data, error } = await a.client
      .from("shops")
      .update({ name: "renamed" })
      .eq("id", shop)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("A は deleted_at と place_id を更新できない（権限エラー）", async () => {
    const shop = await createShop(a.id);
    const r1 = await a.client
      .from("shops")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", shop);
    expect(r1.error).not.toBeNull();
    const r2 = await a.client
      .from("shops")
      .update({ place_id: "x" })
      .eq("id", shop);
    expect(r2.error).not.toBeNull();
  });

  it("管理者は soft_delete_shop で削除でき、一般ユーザーは実行できない", async () => {
    const shop = await createShop(a.id);
    const denied = await a.client.rpc("soft_delete_shop", { p_shop: shop });
    expect(denied.error).not.toBeNull();
    const ok = await c.client.rpc("soft_delete_shop", { p_shop: shop });
    expect(ok.error).toBeNull();
    const { data } = await adminClient()
      .from("shops")
      .select("deleted_at")
      .eq("id", shop)
      .single();
    expect(data?.deleted_at).not.toBeNull();
  });

  it("ログインユーザーは店を作成できる（created_by は本人）", async () => {
    const { error } = await a.client.from("shops").insert({
      name: "new",
      lat: 35,
      lng: 139,
      created_by: a.id,
    });
    expect(error).toBeNull();
  });

  it("同じ place_id の 2 回目の insert は 23505 で失敗する", async () => {
    const placeId = uniqueId("place");
    await createShop(a.id, { place_id: placeId });
    const { error } = await adminClient()
      .from("shops")
      .insert({ name: "dup", lat: 1, lng: 1, place_id: placeId });
    expect(error?.code).toBe("23505");
  });

  it("CHECK 制約: 不正な genre は拒否される", async () => {
    const { error } = await adminClient()
      .from("shops")
      .insert({ name: "x", lat: 1, lng: 1, genre: "nonsense" });
    expect(error?.code).toBe("23514");
  });
});

describe("visits", () => {
  it("B は A の visit を update / delete できない", async () => {
    const shop = await createShop(a.id);
    const visit = await createVisit(shop, a.id);
    const upd = await b.client
      .from("visits")
      .update({ comment: "hacked" })
      .eq("id", visit)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const del = await b.client.from("visits").delete().eq("id", visit).select("id");
    expect(del.error).not.toBeNull();
    expect(del.data ?? []).toHaveLength(0);
    const { data } = await adminClient()
      .from("visits")
      .select("comment")
      .eq("id", visit)
      .single();
    expect(data?.comment).toBeNull();
  });

  it("本人は自分の visit を更新できる", async () => {
    const shop = await createShop(a.id);
    const visit = await createVisit(shop, a.id);
    const { data } = await a.client
      .from("visits")
      .update({ comment: "mine" })
      .eq("id", visit)
      .select("id");
    expect(data).toHaveLength(1);
  });

  it("管理者は A の visit に deleted_at を設定できる", async () => {
    const shop = await createShop(a.id);
    const visit = await createVisit(shop, a.id);
    const { data, error } = await c.client
      .from("visits")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", visit)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("他人名義の visit は作成できない", async () => {
    const shop = await createShop(a.id);
    const { error } = await b.client.from("visits").insert({
      shop_id: shop,
      user_id: a.id,
      visited_on: "2026-01-01",
    });
    expect(error).not.toBeNull();
  });

  it("本人名義の visit は作成できる", async () => {
    const shop = await createShop(a.id);
    const { error } = await a.client.from("visits").insert({
      shop_id: shop,
      user_id: a.id,
      visited_on: "2026-01-01",
      smoking: "no_smoking",
    });
    expect(error).toBeNull();
  });

  it("CHECK 制約: 不正な payment_methods は拒否される", async () => {
    const shop = await createShop(a.id);
    const { error } = await adminClient().from("visits").insert({
      shop_id: shop,
      user_id: a.id,
      visited_on: "2026-01-01",
      payment_methods: ["bitcoin"],
    });
    expect(error?.code).toBe("23514");
  });
});

describe("ハードデリートと制約", () => {
  it("本人・管理者とも visits / photos を DELETE できない", async () => {
    const shop = await createShop(a.id);
    const visit = await createVisit(shop, a.id);
    for (const u of [a, c]) {
      const r = await u.client.from("visits").delete().eq("id", visit);
      expect(r.error).not.toBeNull();
      const p = await u.client.from("photos").delete().eq("visit_id", visit);
      expect(p.error).not.toBeNull();
    }
  });

  it("profiles.nickname は 1〜20 文字", async () => {
    const empty = await adminClient()
      .from("profiles")
      .update({ nickname: "" })
      .eq("id", a.id);
    expect(empty.error?.code).toBe("23514");
    const long = await a.client
      .from("profiles")
      .update({ nickname: "x".repeat(21) })
      .eq("id", a.id);
    expect(long.error?.code).toBe("23514");
    const ok = await a.client
      .from("profiles")
      .update({ nickname: "x".repeat(20) })
      .eq("id", a.id);
    expect(ok.error).toBeNull();
  });

  it("visits.comment は 1000 文字まで", async () => {
    const shop = await createShop(a.id);
    const visit = await createVisit(shop, a.id);
    const bad = await a.client
      .from("visits")
      .update({ comment: "x".repeat(1001) })
      .eq("id", visit);
    expect(bad.error?.code).toBe("23514");
    const ok = await a.client
      .from("visits")
      .update({ comment: "x".repeat(1000) })
      .eq("id", visit);
    expect(ok.error).toBeNull();
  });

  it("shops.reference_url は null・空・http(s) のみ", async () => {
    const shop = await createShop(a.id);
    const bad = await a.client
      .from("shops")
      .update({ reference_url: "javascript:alert(1)" })
      .eq("id", shop);
    expect(bad.error?.code).toBe("23514");
    for (const v of ["https://example.com/x", "http://example.com", "", null]) {
      const ok = await a.client
        .from("shops")
        .update({ reference_url: v })
        .eq("id", shop);
      expect(ok.error).toBeNull();
    }
  });
});

describe("app_settings / signup_attempts", () => {
  it("A は app_settings を 0 件しか読めず、insert も失敗する", async () => {
    await adminClient()
      .from("app_settings")
      .upsert({ key: "passphrase_hash", value: "secret" });
    const sel = await a.client.from("app_settings").select("*");
    expect(sel.data ?? []).toHaveLength(0);
    const ins = await a.client
      .from("app_settings")
      .insert({ key: "evil", value: "x" });
    expect(ins.error).not.toBeNull();
  });

  it("A は signup_attempts を読めず、書けない", async () => {
    const sel = await a.client.from("signup_attempts").select("*");
    expect(sel.data ?? []).toHaveLength(0);
    const ins = await a.client.from("signup_attempts").insert({ ip: "1.2.3.4" });
    expect(ins.error).not.toBeNull();
  });
});

describe("profiles", () => {
  it("ログインユーザーは全員の profile を読めるが、未ログインは読めない", async () => {
    const { data } = await b.client.from("profiles").select("id").eq("id", a.id);
    expect(data).toHaveLength(1);
    const anon = await anonClient().from("profiles").select("id");
    expect(anon.data ?? []).toHaveLength(0);
  });

  it("本人はニックネームを変更できるが is_admin は変更できない", async () => {
    const ok = await a.client
      .from("profiles")
      .update({ nickname: "newnick" })
      .eq("id", a.id)
      .select("id");
    expect(ok.data).toHaveLength(1);
    const bad = await a.client
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", a.id);
    expect(bad.error).not.toBeNull();
  });

  it("他人の profile は更新できない", async () => {
    const r = await b.client
      .from("profiles")
      .update({ nickname: "x" })
      .eq("id", a.id)
      .select("id");
    expect(r.data ?? []).toHaveLength(0);
  });
});
