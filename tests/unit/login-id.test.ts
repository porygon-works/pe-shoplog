import { describe, expect, it } from "vitest";
import {
  AUTH_EMAIL_DOMAIN,
  isValidLoginId,
  normalizeLoginId,
  toAuthEmail,
} from "@/lib/auth/login-id";

describe("login-id", () => {
  it("trims and lowercases", () => {
    expect(normalizeLoginId(" Taro_1 ")).toBe("taro_1");
  });
  it("validates length and charset", () => {
    expect(isValidLoginId("ab")).toBe(false);
    expect(isValidLoginId("abc")).toBe(true);
    expect(isValidLoginId("a".repeat(20))).toBe(true);
    expect(isValidLoginId("a".repeat(21))).toBe(false);
    expect(isValidLoginId("taro-1")).toBe(false);
    expect(isValidLoginId("taro_1")).toBe(true);
  });
  it("maps to a dummy email", () => {
    expect(AUTH_EMAIL_DOMAIN).toBe("users.pe-shoplog.invalid");
    expect(toAuthEmail("taro")).toBe("taro@users.pe-shoplog.invalid");
    expect(toAuthEmail(" Taro ")).toBe("taro@users.pe-shoplog.invalid");
  });
});
