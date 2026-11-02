import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyShopFilters, type ShopFilters } from "@/lib/filters/shop-filters";
import { createShop, createTestUser, createVisit, uniqueId } from "./helpers";

const base: ShopFilters = {
  q: "",
  genre: [],
  styles: [],
  smoking: [],
  price: [],
  purpose: [],
  want: false,
  time: [],
  sort: "new",
};

let client: SupabaseClient;
let userId: string;
let tag: string;
let smokeShop: string; // 禁煙・打ち上げ・焼き鳥
let wantShop: string; // 記録なし
let otherShop: string; // 喫煙可・チーム会議
let percentShop: string;

beforeAll(async () => {
  const u = await createTestUser(uniqueId("f"));
  client = u.client;
  userId = u.id;
  tag = uniqueId("t");
  smokeShop = await createShop(u.id, { name: `${tag}-禁煙店`, genre: "yakitori", styles: ["izakaya"], smoking: "no_smoking" });
  await createVisit(smokeShop, u.id, { purpose: "celebration", price_range: "3000_4999" });
  wantShop = await createShop(u.id, { name: `${tag}-気になる店`, genre: "ramen" });
  otherShop = await createShop(u.id, { name: `${tag}-喫煙店`, genre: "washoku", styles: ["bar"], smoking: "smoking_ok" });
  await createVisit(otherShop, u.id, { purpose: "team_meeting", price_range: "5000_6999" });
  await createVisit(otherShop, u.id, { purpose: "team_meeting" });
  percentShop = await createShop(u.id, { name: `${tag}-100%_店` });
});

async function ids(f: Partial<ShopFilters>): Promise<string[]> {
  // 他のテストのデータと混ざらないよう、このテストの店名タグで絞る。
  const { data, error } = await applyShopFilters(
    client.from("shop_index").select("id").ilike("name", `${tag}%`),
    { ...base, ...f },
  );
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

describe("applyShopFilters（shop_index）", () => {
  it("条件なしなら 4 店", async () => {
    expect(await ids({})).toHaveLength(4);
  });

  it("smoking: no_smoking は禁煙の店だけ", async () => {
    expect(await ids({ smoking: ["no_smoking"] })).toEqual([smokeShop]);
  });

  it("want: true は記録 0 件の店だけ（%_店も含む）", async () => {
    expect((await ids({ want: true })).sort()).toEqual([wantShop, percentShop].sort());
  });

  it("purpose: celebration は該当店だけ", async () => {
    expect(await ids({ purpose: ["celebration"] })).toEqual([smokeShop]);
  });

  it("genre / styles / price", async () => {
    expect(await ids({ genre: ["ramen"] })).toEqual([wantShop]);
    expect(await ids({ styles: ["bar", "izakaya"] })).toHaveLength(2);
    expect(await ids({ price: ["5000_6999"] })).toEqual([otherShop]);
  });

  it("q の % と _ はワイルドカードにならない", async () => {
    expect(await ids({ q: "100%" })).toEqual([percentShop]);
    expect(await ids({ q: "0%_" })).toEqual([percentShop]);
    expect(await ids({ q: "%" })).toEqual([percentShop]);
    expect(await ids({ q: "禁煙店" })).toEqual([smokeShop]);
  });

  it("time: 既定は夜、昼を持つ店だけ lunch で絞れる", async () => {
    const lunchShop = await createShop(userId, { name: `${tag}-昼店`, time_slots: ["lunch", "dinner"] });
    expect((await ids({ time: ["lunch"] })).sort()).toEqual([lunchShop]);
    expect(await ids({ time: ["dinner"] })).toHaveLength(5);
    expect(await ids({ time: ["lunch", "dinner"] })).toHaveLength(5);
  });

  it("sort: visits は記録の多い順", async () => {
    const r = await ids({ sort: "visits" });
    expect(r[0]).toBe(otherShop);
    expect(r[1]).toBe(smokeShop);
  });
});
