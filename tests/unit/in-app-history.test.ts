import { beforeEach, describe, expect, it } from "vitest";
import {
  incrementNavCount,
  NAV_COUNT_KEY,
  readNavCount,
  shouldGoBack,
} from "@/lib/nav/in-app-history";

describe("shouldGoBack", () => {
  it("最初の画面（0, 1）では戻らない", () => {
    expect(shouldGoBack(0)).toBe(false);
    expect(shouldGoBack(1)).toBe(false);
  });
  it("2 画面以上たどっていれば戻る", () => {
    expect(shouldGoBack(2)).toBe(true);
    expect(shouldGoBack(10)).toBe(true);
  });
  it("不正な値では戻らない", () => {
    expect(shouldGoBack(Number.NaN)).toBe(false);
  });
});

describe("nav count", () => {
  beforeEach(() => sessionStorage.clear());
  it("増えていく", () => {
    expect(readNavCount()).toBe(0);
    incrementNavCount("/map");
    incrementNavCount("/search");
    expect(readNavCount()).toBe(2);
  });
  it("同じパスの再実行は数えない", () => {
    incrementNavCount("/map");
    incrementNavCount("/map");
    expect(readNavCount()).toBe(1);
    incrementNavCount("/search");
    incrementNavCount("/map");
    expect(readNavCount()).toBe(3);
  });
  it("壊れた値は 0 として扱う", () => {
    sessionStorage.setItem(NAV_COUNT_KEY, "abc");
    expect(readNavCount()).toBe(0);
  });
});
