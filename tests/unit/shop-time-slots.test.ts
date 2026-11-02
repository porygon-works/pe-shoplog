import { describe, expect, it } from "vitest";
import { timeSlotsText } from "@/lib/options";
import { shopInputSchema } from "@/lib/validation";

describe("shopInputSchema.timeSlots", () => {
  it("未指定の既定は夜", () => {
    expect(shopInputSchema.parse({ name: "店" }).timeSlots).toEqual(["dinner"]);
  });

  it("昼・夜を複数選べて、重複は除かれる", () => {
    expect(shopInputSchema.parse({ name: "店", timeSlots: ["lunch", "dinner", "lunch"] }).timeSlots).toEqual([
      "lunch",
      "dinner",
    ]);
  });

  it("空・不正な値は失敗する", () => {
    expect(shopInputSchema.safeParse({ name: "店", timeSlots: [] }).success).toBe(false);
    expect(shopInputSchema.safeParse({ name: "店", timeSlots: ["night"] }).success).toBe(false);
  });
});

describe("timeSlotsText", () => {
  it("選択肢の並び順で「・」区切りにする", () => {
    expect(timeSlotsText(["dinner", "lunch"])).toBe("昼・夜");
    expect(timeSlotsText(["dinner"])).toBe("夜");
    expect(timeSlotsText([])).toBe("");
  });
});
