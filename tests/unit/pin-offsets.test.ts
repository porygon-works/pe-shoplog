import { describe, expect, it } from "vitest";
import { pinOffsets } from "@/components/shop-map";

describe("pinOffsets（同じ位置の店のピンをずらす）", () => {
  it("同じ位置の 2 店は左右に、離れた店はずらさない", () => {
    const o = pinOffsets([
      { id: "a", lat: 35.731709, lng: 139.70961, visitCount: 2 },
      { id: "b", lat: 35.731709, lng: 139.70961, visitCount: 2 },
      { id: "c", lat: 35.7333, lng: 139.71, visitCount: 0 },
    ]);
    expect(o.get("a")).toBe(-14);
    expect(o.get("b")).toBe(14);
    expect(o.get("c")).toBe(0);
  });
  it("3 店なら中央はそのまま", () => {
    const s = (id: string) => ({ id, lat: 35.7, lng: 139.7, visitCount: 1 });
    const o = pinOffsets([s("a"), s("b"), s("c")]);
    expect([o.get("a"), o.get("b"), o.get("c")]).toEqual([-28, 0, 28]);
  });
});
