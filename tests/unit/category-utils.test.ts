import { describe, expect, it } from "vitest";
import {
  CATEGORY_VALUE_RE,
  categoryLabelSchema,
  generateCategoryValue,
  hasDuplicateLabel,
  hasInvalidCategory,
  selectableOptions,
  type Categories,
  type Category,
} from "@/lib/category-utils";
import { shopInputSchema } from "@/lib/validation";

const c = (value: string, label: string, hidden = false): Category => ({ value, label, hidden, sortOrder: 0 });
const categories: Categories = {
  genres: [c("ramen", "ラーメン"), c("old", "旧ジャンル", true), c("unknown", "不明")],
  styles: [c("bar", "バー"), c("oldstyle", "旧形態", true)],
};

describe("generateCategoryValue", () => {
  it("c_ + 16 進 8 桁で、DB の value の形式を満たす", () => {
    const v = generateCategoryValue();
    expect(v).toMatch(/^c_[0-9a-f]{8}$/);
    expect(CATEGORY_VALUE_RE.test(v)).toBe(true);
  });

  it("毎回違う値になる", () => {
    const vs = new Set(Array.from({ length: 50 }, generateCategoryValue));
    expect(vs.size).toBe(50);
  });
});

describe("categoryLabelSchema", () => {
  it("前後の空白を除き、1〜20 文字を許可する", () => {
    expect(categoryLabelSchema.parse("  ビストロ ")).toBe("ビストロ");
    expect(categoryLabelSchema.safeParse("a".repeat(20)).success).toBe(true);
  });

  it("空・空白のみ・21 文字以上は拒否する", () => {
    expect(categoryLabelSchema.safeParse("").success).toBe(false);
    expect(categoryLabelSchema.safeParse("   ").success).toBe(false);
    expect(categoryLabelSchema.safeParse("a".repeat(21)).success).toBe(false);
  });
});

describe("hasDuplicateLabel", () => {
  it("非表示を含めて同じ表示名を検出し、自分自身は除く", () => {
    expect(hasDuplicateLabel(categories.genres, "旧ジャンル")).toBe(true);
    expect(hasDuplicateLabel(categories.genres, "旧ジャンル", "old")).toBe(false);
    expect(hasDuplicateLabel(categories.genres, "新しい")).toBe(false);
  });
});

describe("selectableOptions", () => {
  it("非表示を除く。今の値は非表示でも残す", () => {
    expect(selectableOptions(categories.genres).map((o) => o.value)).toEqual(["ramen", "unknown"]);
    expect(selectableOptions(categories.genres, ["old"]).map((o) => o.value)).toEqual(["ramen", "old", "unknown"]);
  });

  it("excludeUnknown で「不明」を外す", () => {
    expect(selectableOptions(categories.genres, [], true).map((o) => o.value)).toEqual(["ramen"]);
  });
});

describe("hasInvalidCategory", () => {
  it("存在する表示中の値は問題なし", () => {
    expect(hasInvalidCategory(categories, { genres: ["ramen"], styles: ["bar"] })).toBe(false);
  });

  it("存在しない値は問題あり", () => {
    expect(hasInvalidCategory(categories, { genres: ["nope"], styles: [] })).toBe(true);
    expect(hasInvalidCategory(categories, { genres: ["ramen"], styles: ["nope"] })).toBe(true);
  });

  it("非表示の値は新規選択では不可、元の値なら可", () => {
    expect(hasInvalidCategory(categories, { genres: ["old"], styles: [] })).toBe(true);
    expect(hasInvalidCategory(categories, { genres: ["ramen"], styles: ["oldstyle"] })).toBe(true);
    const current = { genres: ["old"], styles: ["oldstyle"] };
    expect(hasInvalidCategory(categories, { genres: ["old"], styles: ["oldstyle", "bar"] }, current)).toBe(false);
    expect(hasInvalidCategory(categories, { genres: ["ramen"], styles: ["oldstyle"] }, { genres: ["ramen"], styles: [] })).toBe(
      true,
    );
  });

  it("ジャンルは複数でき、どれか 1 つでも選べない値なら問題あり。「不明」は選べない", () => {
    expect(hasInvalidCategory(categories, { genres: ["ramen"], styles: [] })).toBe(false);
    expect(hasInvalidCategory(categories, { genres: [], styles: [] })).toBe(false);
    expect(hasInvalidCategory(categories, { genres: ["ramen", "nope"], styles: [] })).toBe(true);
    expect(hasInvalidCategory(categories, { genres: ["unknown"], styles: [] })).toBe(true);
  });
});

describe("shopInputSchema の区分", () => {
  it("形式だけ検査する（存在確認はサーバー側）", () => {
    expect(shopInputSchema.safeParse({ name: "店", genres: ["c_0a1b2c3d"], styles: ["bar"] }).success).toBe(true);
    expect(shopInputSchema.safeParse({ name: "店", genres: ["Bad Value"] }).success).toBe(false);
    expect(shopInputSchema.safeParse({ name: "店", styles: ["x;y"] }).success).toBe(false);
  });
});
