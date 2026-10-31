import { describe, expect, it } from "vitest";
import {
  GENRES,
  LIST_KINDS,
  PAYMENT_METHODS,
  PHOTO_KINDS,
  PRICE_RANGES,
  PURPOSES,
  RESERVATIONS,
  SMOKING,
  STYLES,
  labelOf,
  values,
} from "@/lib/options";

describe("options", () => {
  const all = {
    SMOKING,
    PRICE_RANGES,
    PURPOSES,
    RESERVATIONS,
    PAYMENT_METHODS,
    PHOTO_KINDS,
    GENRES,
    STYLES,
    LIST_KINDS,
  };

  for (const [name, options] of Object.entries(all)) {
    it(`${name} の value は重複しない`, () => {
      const vs = options.map((o) => o.value);
      expect(new Set(vs).size).toBe(vs.length);
    });
  }

  it("labelOf はラベルを返す", () => {
    expect(labelOf(SMOKING, "heated_only")).toBe("加熱式のみ");
  });

  it("values は値の配列を返す", () => {
    expect(values(RESERVATIONS)).toEqual(["reserved", "walk_in", "unknown"]);
  });

  it("PAYMENT_METHODS は unknown を持たない", () => {
    expect(values(PAYMENT_METHODS)).not.toContain("unknown");
  });
});
