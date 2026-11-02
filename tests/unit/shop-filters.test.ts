import { describe, expect, it } from "vitest";
import {
  applyShopFilters,
  escapeLike,
  hasAll,
  shopFilterCache,
  SMOKABLE,
  toggleValues,
  type ShopFilters,
} from "@/lib/filters/shop-filters";

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

/** 呼び出しを記録するだけのクエリビルダー。 */
function recorder() {
  const calls: [string, ...unknown[]][] = [];
  const q = new Proxy(
    {},
    {
      get:
        (_t, name: string) =>
        (...args: unknown[]) => {
          calls.push([name, ...args]);
          return q;
        },
    },
  );
  return { q: q as never, calls };
}

describe("escapeLike", () => {
  it("% _ \\ をエスケープする", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });
});

describe("applyShopFilters", () => {
  it("q = '100%' のとき ilike の値は %100\\%% になる", () => {
    const { q, calls } = recorder();
    applyShopFilters(q, { ...base, q: "100%" });
    expect(calls).toContainEqual(["ilike", "name", "%100\\%%"]);
  });

  it("空の条件では絞り込まず、新着順で並べる", () => {
    const { q, calls } = recorder();
    applyShopFilters(q, base);
    expect(calls.map((c) => c[0])).toEqual(["order"]);
    expect(calls[0]).toEqual(["order", "created_at", { ascending: false }]);
  });

  it("各条件を対応する演算子で加える", () => {
    const { q, calls } = recorder();
    applyShopFilters(q, {
      ...base,
      q: "  とり ",
      genre: ["yakitori"],
      styles: ["izakaya"],
      smoking: ["no_smoking"],
      price: ["3000_4999"],
      purpose: ["celebration"],
      want: true,
    });
    expect(calls).toContainEqual(["ilike", "name", "%とり%"]);
    expect(calls).toContainEqual(["overlaps", "genres", ["yakitori"]]);
    expect(calls).toContainEqual(["overlaps", "styles", ["izakaya"]]);
    expect(calls).toContainEqual(["in", "smoking", ["no_smoking"]]);
    expect(calls).toContainEqual(["in", "price_range", ["3000_4999"]]);
    expect(calls).toContainEqual(["overlaps", "purposes", ["celebration"]]);
    expect(calls).toContainEqual(["eq", "visit_count", 0]);
  });

  it("記録の多い順では visit_count の降順", () => {
    const { q, calls } = recorder();
    applyShopFilters(q, { ...base, sort: "visits" });
    expect(calls[0]).toEqual(["order", "visit_count", { ascending: false }]);
  });
});

describe("クイックチップの切り替え", () => {
  it("吸える = 喫煙可・分煙・加熱式のみ", () => {
    expect([...SMOKABLE]).toEqual(["smoking_ok", "separated", "heated_only"]);
  });

  it("toggleValues: 全部入っていなければ足し、全部入っていれば外す", () => {
    expect(toggleValues(["no_smoking"], SMOKABLE)).toEqual([
      "no_smoking",
      "smoking_ok",
      "separated",
      "heated_only",
    ]);
    expect(toggleValues(["separated"], SMOKABLE).sort()).toEqual([...SMOKABLE].sort());
    expect(toggleValues(["no_smoking", ...SMOKABLE], SMOKABLE)).toEqual(["no_smoking"]);
  });

  it("hasAll", () => {
    expect(hasAll(["a", "b"], ["a"])).toBe(true);
    expect(hasAll(["a"], ["a", "b"])).toBe(false);
  });
});

describe("URL パラメータの検証", () => {
  it("許可されていない値・unknown・引用符つきの値は捨てる", () => {
    const f = shopFilterCache.parse({
      smoking: '"x,no_smoking,unknown,bogus',
      genre: "unknown,ramen",
      styles: "izakaya;evil,bar",
      price: "unknown,under_3000",
      purpose: "x),celebration",
    });
    expect(f.smoking).toEqual(["no_smoking"]);
    expect(f.genre).toEqual(["ramen"]);
    expect(f.styles).toEqual(["bar"]);
    expect(f.price).toEqual(["under_3000"]);
    expect(f.purpose).toEqual(["celebration"]);
  });

  it("time は lunch / dinner だけ残し、与えられたときだけ time_slots の overlaps になる", () => {
    const f = shopFilterCache.parse({ time: "lunch,unknown,bogus,dinner" });
    expect(f.time).toEqual(["lunch", "dinner"]);
    expect(shopFilterCache.parse({}).time).toEqual([]);
    const { q, calls } = recorder();
    applyShopFilters(q, { ...base, time: ["lunch"] });
    expect(calls).toContainEqual(["overlaps", "time_slots", ["lunch"]]);
  });

  it("ジャンル・形態は形式だけ検査する（DB で増減するため許可リストは持たない）", () => {
    const f = shopFilterCache.parse({
      genre: "c_0a1b2c3d,Bad-Value,x'y,ramen",
      styles: "c_ffffffff,UPPER,a b",
    });
    expect(f.genre).toEqual(["c_0a1b2c3d", "ramen"]);
    expect(f.styles).toEqual(["c_ffffffff"]);
  });

  it("捨てた値はクエリビルダーに渡らない", () => {
    const { q, calls } = recorder();
    applyShopFilters(q, shopFilterCache.parse({ smoking: '"x,unknown' }));
    expect(calls.map((c) => c[0])).toEqual(["order"]);
  });

  it("q は 100 文字までに切る", () => {
    expect(shopFilterCache.parse({ q: "あ".repeat(150) }).q).toHaveLength(100);
  });
});
