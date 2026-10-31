import { describe, expect, it } from "vitest";
import { LIST_NAME_MAX, excerptOf, normalizeListName, sortPickerLists } from "@/lib/lists/shared";

describe("normalizeListName", () => {
  it("前後の空白を除き、1〜上限文字だけ通す", () => {
    expect(normalizeListName("  2次会向き ")).toBe("2次会向き");
    expect(normalizeListName("   ")).toBeNull();
    expect(normalizeListName("あ".repeat(LIST_NAME_MAX))).not.toBeNull();
    expect(normalizeListName("あ".repeat(LIST_NAME_MAX + 1))).toBeNull();
    expect(normalizeListName(undefined)).toBeNull();
  });
});

describe("sortPickerLists", () => {
  it("既定のリストを先頭に、気になる→お気に入り、作成順で並べる", () => {
    const l = (id: string, isDefault: boolean, kind: "want" | "favorite", createdAt: string) => ({
      id,
      isDefault,
      kind,
      createdAt,
    });
    const sorted = sortPickerLists([
      l("w2", false, "want", "2026-01-02"),
      l("f-def", true, "favorite", "2026-01-01"),
      l("w1", false, "want", "2026-01-01"),
      l("w-def", true, "want", "2026-01-01"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["w-def", "f-def", "w1", "w2"]);
  });
});

describe("excerptOf", () => {
  it("40文字まではそのまま、超えたら省略記号を付ける", () => {
    expect(excerptOf(null)).toBeNull();
    expect(excerptOf("")).toBeNull();
    expect(excerptOf("あ".repeat(40))).toBe("あ".repeat(40));
    expect(excerptOf("あ".repeat(41))).toBe(`${"あ".repeat(40)}…`);
  });
});
