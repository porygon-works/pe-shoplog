import { describe, expect, it } from "vitest";
import { computeTargetSize } from "@/lib/images/resize";

describe("computeTargetSize", () => {
  it("長辺が 1600 を超える横長は縮小する", () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });
  it("長辺が 1600 以下ならそのまま", () => {
    expect(computeTargetSize(1000, 800)).toEqual({ width: 1000, height: 800 });
  });
  it("縦長も長辺を 1600 にする", () => {
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it("最大辺を指定できる", () => {
    expect(computeTargetSize(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
  });
});
