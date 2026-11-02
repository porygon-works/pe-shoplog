import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, createShop, createTestUser, createVisit, uniqueId } from "./helpers";

type U = { id: string; client: SupabaseClient };
let a: U, b: U;

beforeAll(async () => {
  a = await createTestUser(uniqueId("a"));
  b = await createTestUser(uniqueId("b"));
});

async function indexRow(client: SupabaseClient, shop: string) {
  const { data, error } = await client
    .from("shop_index")
    .select("*")
    .eq("id", shop)
    .maybeSingle();
  if (error) throw error;
  return data;
}

describe("shop_index", () => {
  it("time_slots は既定で夜、CHECK で不正値・空配列は拒否され、shop_index の末尾の列にも出る", async () => {
    const shop = await createShop(a.id);
    expect((await indexRow(a.client, shop))?.time_slots).toEqual(["dinner"]);
    const both = await createShop(a.id, { time_slots: ["lunch", "dinner"] });
    expect((await indexRow(a.client, both))?.time_slots).toEqual(["lunch", "dinner"]);
    await expect(createShop(a.id, { time_slots: [] })).rejects.toMatchObject({ code: "23514" });
    await expect(createShop(a.id, { time_slots: ["night"] })).rejects.toMatchObject({ code: "23514" });
    const upd = await a.client.from("shops").update({ time_slots: ["lunch"] }).eq("id", shop).select("id");
    expect(upd.error).toBeNull();
    expect((await indexRow(a.client, shop))?.time_slots).toEqual(["lunch"]);
  });

  it("smoking は店の値（記録の喫煙は使わない）。店を編集すると変わる", async () => {
    const shop = await createShop(a.id, { smoking: "separated" });
    await createVisit(shop, a.id, { visited_on: "2026-01-01", smoking: "smoking_ok" });
    await createVisit(shop, a.id, { visited_on: "2026-02-01", smoking: "no_smoking" });
    await createVisit(shop, a.id, { visited_on: "2026-03-01", smoking: "unknown" });
    const row = await indexRow(a.client, shop);
    expect(row?.smoking).toBe("separated");
    const upd = await a.client.from("shops").update({ smoking: "no_smoking" }).eq("id", shop).select("id");
    expect(upd.error).toBeNull();
    expect((await indexRow(a.client, shop))?.smoking).toBe("no_smoking");
    await expect(createShop(a.id, { smoking: "nope" })).rejects.toMatchObject({ code: "23514" });
    expect(row?.visit_count).toBe(3);
    expect(row?.last_visited_on).toBe("2026-03-01");
  });

  it("avg_rating は評価のある記録の平均（小数 1 桁）、rating_count はその件数", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, { rating: 5 });
    await createVisit(shop, a.id, { rating: 4 });
    await createVisit(shop, b.id, { rating: 4 });
    await createVisit(shop, b.id, {});
    const row = await indexRow(a.client, shop);
    expect(Number(row?.avg_rating)).toBe(4.3);
    expect(row?.rating_count).toBe(3);
    expect(row?.visit_count).toBe(4);
  });

  it("評価がなければ avg_rating は null、rating_count は 0", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, {});
    const row = await indexRow(a.client, shop);
    expect(row?.avg_rating).toBeNull();
    expect(row?.rating_count).toBe(0);
  });

  it("日付なしの記録は最新扱いにならない（price_range・last_visited_on）", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, { visited_on: "2026-01-01", price_range: "3000_4999" });
    await createVisit(shop, a.id, { visited_on: null, price_range: "5000_6999" });
    const row = await indexRow(a.client, shop);
    expect(row?.last_visited_on).toBe("2026-01-01");
    // 件数が同じなら日付のある方（nulls last）
    expect(row?.price_range).toBe("3000_4999");
    expect(row?.visit_count).toBe(2);
  });

  it("price_range は unknown 以外の最頻値", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, { visited_on: "2026-01-01", price_range: "5000_6999" });
    await createVisit(shop, a.id, { visited_on: "2026-01-02", price_range: "5000_6999" });
    await createVisit(shop, a.id, { visited_on: "2026-01-03", price_range: "3000_4999" });
    await createVisit(shop, a.id, { visited_on: "2026-01-04", price_range: "unknown" });
    expect((await indexRow(a.client, shop))?.price_range).toBe("5000_6999");
  });

  it("price_range は同数なら新しい方", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, { visited_on: "2026-01-01", price_range: "5000_6999" });
    await createVisit(shop, a.id, { visited_on: "2026-02-01", price_range: "3000_4999" });
    expect((await indexRow(a.client, shop))?.price_range).toBe("3000_4999");
  });

  it("purposes は unknown を除く重複なしの配列、max_party_size は最大値", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, { purpose: "celebration", party_size: 8 });
    await createVisit(shop, a.id, { purpose: "celebration", party_size: 20 });
    await createVisit(shop, b.id, { purpose: "entertainment", party_size: 4 });
    await createVisit(shop, b.id, { purpose: "unknown" });
    const row = await indexRow(a.client, shop);
    expect([...row!.purposes].sort()).toEqual(["celebration", "entertainment"]);
    expect(row?.max_party_size).toBe(20);
  });

  it("記録のない店は visit_count = 0、smoking / price_range = unknown", async () => {
    const shop = await createShop(a.id);
    const row = await indexRow(a.client, shop);
    expect(row?.visit_count).toBe(0);
    expect(row?.smoking).toBe("unknown");
    expect(row?.price_range).toBe("unknown");
    expect(row?.purposes).toEqual([]);
    expect(row?.last_visited_on).toBeNull();
  });

  it("unknown の記録しかない店は smoking / price_range = unknown", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, { smoking: "unknown", price_range: "unknown" });
    const row = await indexRow(a.client, shop);
    expect(row?.visit_count).toBe(1);
    expect(row?.smoking).toBe("unknown");
    expect(row?.price_range).toBe("unknown");
  });

  it("削除済みの記録は集計に含めない", async () => {
    const shop = await createShop(a.id);
    await createVisit(shop, a.id, { visited_on: "2026-01-01", price_range: "3000_4999" });
    await createVisit(shop, a.id, {
      visited_on: "2026-02-01",
      price_range: "5000_6999",
      deleted_at: new Date().toISOString(),
    });
    const row = await indexRow(a.client, shop);
    expect(row?.visit_count).toBe(1);
    expect(row?.price_range).toBe("3000_4999");
  });

  it("論理削除した店は出ない", async () => {
    const shop = await createShop(a.id);
    await adminClient()
      .from("shops")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", shop);
    expect(await indexRow(a.client, shop)).toBeNull();
  });

  it("未ログインでは見えない", async () => {
    const { anonClient } = await import("./helpers");
    const { data } = await anonClient().from("shop_index").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

describe("public_lists", () => {
  async function makeList(isPublic: boolean) {
    const { data } = await a.client
      .from("lists")
      .insert({ owner_id: a.id, name: `l-${uniqueId()}`, kind: "favorite", is_public: isPublic })
      .select("id")
      .single();
    return data!.id as string;
  }

  it("非公開リストは出ず、公開リストは shop_count と owner_nickname つきで出る", async () => {
    const priv = await makeList(false);
    const pub = await makeList(true);
    const shop = await createShop(a.id);
    for (const l of [priv, pub]) {
      await a.client.from("list_items").insert({ list_id: l, shop_id: shop });
    }
    const { data, error } = await b.client
      .from("public_lists")
      .select("*")
      .in("id", [priv, pub]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      kind: "personal",
      id: pub,
      list_kind: "favorite",
      owner_id: a.id,
      owner_nickname: expect.any(String),
      shop_count: 1,
    });
    expect(data![0].updated_at).toBeTruthy();
  });

  it("論理削除した店は shop_count から除外される", async () => {
    const pub = await makeList(true);
    const s1 = await createShop(a.id);
    const s2 = await createShop(a.id);
    for (const s of [s1, s2]) {
      await a.client.from("list_items").insert({ list_id: pub, shop_id: s });
    }
    await adminClient()
      .from("shops")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", s2);
    const { data } = await b.client.from("public_lists").select("shop_count").eq("id", pub);
    expect(data).toEqual([{ shop_count: 1 }]);
  });

  it("共有リストも kind = shared で出る（公開のみ）", async () => {
    const ins = async (isPublic: boolean) =>
      (
        await a.client
          .from("shared_lists")
          .insert({ owner_id: a.id, name: `s-${uniqueId()}`, is_public: isPublic })
          .select("id")
          .single()
      ).data!.id as string;
    const priv = await ins(false);
    const pub = await ins(true);
    const shop = await createShop(a.id);
    await a.client
      .from("shared_list_items")
      .insert({ shared_list_id: pub, shop_id: shop, added_by: a.id });
    const { data } = await b.client
      .from("public_lists")
      .select("kind, id, list_kind, shop_count")
      .in("id", [priv, pub]);
    expect(data).toEqual([{ kind: "shared", id: pub, list_kind: null, shop_count: 1 }]);
  });
});
