import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/ids";

describe("isUuid", () => {
  it("正しい UUID を受け付ける", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });
  it("形だけ似た値や不正な値を拒否する", () => {
    expect(isUuid("-".repeat(36))).toBe(false);
    expect(isUuid("a".repeat(36))).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456-42661417400")).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456-42661417400g")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
