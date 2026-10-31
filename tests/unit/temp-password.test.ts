import { describe, expect, it } from "vitest";
import { TEMP_PASSWORD_ALPHABET, generateTempPassword } from "@/lib/admin/temp-password";

describe("generateTempPassword", () => {
  it("12 文字で、紛らわしい 0O1lI を含まない英数字（100 回）", () => {
    for (let i = 0; i < 100; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/^[A-Za-z0-9]{12}$/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });

  it("使える文字は 57 種類で、毎回同じ値にならない", () => {
    expect(TEMP_PASSWORD_ALPHABET).toHaveLength(57);
    expect(new Set(Array.from({ length: 20 }, generateTempPassword)).size).toBe(20);
  });
});
