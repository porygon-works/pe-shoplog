import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createShop, type CreateShopInput } from "@/lib/shops/create-shop";
import { addShopToDefaultList } from "@/lib/lists/default-list";
import { adminClient, createTestUser, uniqueId } from "./helpers";

type U = { id: string; client: SupabaseClient };
let a: U, b: U;

const base: Omit<CreateShopInput, "userId" | "placeId"> = {
  name: "テスト店",
  genre: "unknown",
  styles: [],
  referenceUrl: "",
  lat: 35.68,
  lng: 139.76,
};

beforeAll(async () => {
  a = await createTestUser(uniqueId("a"));
  b = await createTestUser(uniqueId("b"));
  for (const u of [a, b]) {
    const r = await adminClient().from("lists").insert([
      { owner_id: u.id, name: "気になる", kind: "want", is_default: true },
      { owner_id: u.id, name: "お気に入り", kind: "favorite", is_default: true },
    ]);
    if (r.error) throw r.error;
  }
});

describe("createShop", () => {
  it("同じ placeId で A と B が順に呼ぶと、B は existed: true で同じ shopId", async () => {
    const placeId = uniqueId("pl");
    const r1 = await createShop(a.client, { ...base, userId: a.id, placeId });
    const r2 = await createShop(b.client, { ...base, userId: b.id, placeId });
    expect(r1.existed).toBe(false);
    expect(r2).toEqual({ shopId: r1.shopId, existed: true });
  });

  it("同時に呼んでも 1 件だけ作られ、もう一方は existed: true", async () => {
    const placeId = uniqueId("pl");
    const [r1, r2] = await Promise.all([
      createShop(a.client, { ...base, userId: a.id, placeId }),
      createShop(b.client, { ...base, userId: b.id, placeId }),
    ]);
    expect(r1.shopId).toBe(r2.shopId);
    expect([r1.existed, r2.existed].sort()).toEqual([false, true]);
  });

  it("placeId が null なら 2 回とも新規作成になり、location_fetched_at は null", async () => {
    const r1 = await createShop(a.client, { ...base, userId: a.id, placeId: null });
    const r2 = await createShop(a.client, { ...base, userId: a.id, placeId: null });
    expect(r1.existed).toBe(false);
    expect(r2.existed).toBe(false);
    expect(r1.shopId).not.toBe(r2.shopId);
    const { data } = await adminClient().from("shops").select("location_fetched_at, created_by").eq("id", r1.shopId).single();
    expect(data?.location_fetched_at).toBeNull();
    expect(data?.created_by).toBe(a.id);
  });

  it("placeId ありなら location_fetched_at が入る", async () => {
    const r = await createShop(a.client, { ...base, userId: a.id, placeId: uniqueId("pl") });
    const { data } = await adminClient().from("shops").select("location_fetched_at").eq("id", r.shopId).single();
    expect(data?.location_fetched_at).not.toBeNull();
  });
});

describe("addShopToDefaultList", () => {
  it("既定の「気になる」に入り、2 回呼んでもエラーにならず 1 件のまま", async () => {
    const { shopId } = await createShop(a.client, { ...base, userId: a.id, placeId: null });
    await addShopToDefaultList(a.client, a.id, shopId, "want");
    await addShopToDefaultList(a.client, a.id, shopId, "want");
    const { data } = await adminClient()
      .from("list_items")
      .select("list_id, lists!inner(kind, is_default, owner_id)")
      .eq("shop_id", shopId);
    expect(data).toHaveLength(1);
    expect(data?.[0].lists).toMatchObject({ kind: "want", is_default: true, owner_id: a.id });
  });

  it("既定リストがなければエラー", async () => {
    const c = await createTestUser(uniqueId("c"));
    const { shopId } = await createShop(c.client, { ...base, userId: c.id, placeId: null });
    await expect(addShopToDefaultList(c.client, c.id, shopId, "want")).rejects.toThrow();
  });
});
