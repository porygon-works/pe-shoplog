import { describe, expect, it } from "vitest";
import {
  shopInputSchema,
  signupInputSchema,
  visitInputSchema,
} from "@/lib/validation";

describe("visitInputSchema", () => {
  it("選択項目の既定は unknown", () => {
    const v = visitInputSchema.parse({ visitedOn: "2026-10-31" });
    expect(v.smoking).toBe("unknown");
    expect(v.priceRange).toBe("unknown");
    expect(v.purpose).toBe("unknown");
    expect(v.reservation).toBe("unknown");
    expect(v.paymentMethods).toEqual([]);
  });

  it("コメント 1,001 文字は失敗する", () => {
    const r = visitInputSchema.safeParse({
      visitedOn: "2026-10-31",
      comment: "あ".repeat(1001),
    });
    expect(r.success).toBe(false);
  });

  it("コメント 1,000 文字は通る", () => {
    const r = visitInputSchema.safeParse({
      visitedOn: "2026-10-31",
      comment: "あ".repeat(1000),
    });
    expect(r.success).toBe(true);
  });

  it("partySize: 0 は失敗し、null と 500 は通る", () => {
    expect(
      visitInputSchema.safeParse({ visitedOn: "2026-10-31", partySize: 0 })
        .success,
    ).toBe(false);
    expect(
      visitInputSchema.safeParse({ visitedOn: "2026-10-31", partySize: null })
        .success,
    ).toBe(true);
    expect(
      visitInputSchema.safeParse({ visitedOn: "2026-10-31", partySize: 500 })
        .success,
    ).toBe(true);
    expect(
      visitInputSchema.safeParse({ visitedOn: "2026-10-31", partySize: 501 })
        .success,
    ).toBe(false);
  });

  it("不正な日付は失敗する", () => {
    expect(
      visitInputSchema.safeParse({ visitedOn: "2026-13-40" }).success,
    ).toBe(false);
  });

  it("行った日は未入力（null）でもよい", () => {
    expect(visitInputSchema.parse({}).visitedOn).toBeNull();
    expect(visitInputSchema.parse({ visitedOn: null }).visitedOn).toBeNull();
  });

  it("評価は 1〜5 か未入力", () => {
    expect(visitInputSchema.parse({}).rating).toBeNull();
    for (const r of [1, 3, 5]) expect(visitInputSchema.parse({ rating: r }).rating).toBe(r);
    for (const r of [0, 6, 2.5, Number.NaN]) {
      expect(visitInputSchema.safeParse({ rating: r }).success).toBe(false);
    }
  });
});

describe("shopInputSchema", () => {
  it("javascript: の URL は失敗する", () => {
    const r = shopInputSchema.safeParse({
      name: "店",
      referenceUrl: "javascript:alert(1)",
    });
    expect(r.success).toBe(false);
  });

  it("https の URL と空は通り、既定値が入る", () => {
    const a = shopInputSchema.parse({
      name: "店",
      referenceUrl: "https://example.com/x",
    });
    expect(a.genre).toBe("unknown");
    expect(a.styles).toEqual([]);
    expect(
      shopInputSchema.safeParse({ name: "店", referenceUrl: "" }).success,
    ).toBe(true);
  });

  it("名前は 1〜100 文字", () => {
    expect(shopInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(shopInputSchema.safeParse({ name: "a".repeat(101) }).success).toBe(
      false,
    );
  });
});

describe("signupInputSchema", () => {
  const base = {
    loginId: "Taro_01",
    nickname: "たろう",
    password: "password1",
    passphrase: "ひみつ",
  };

  it("loginId は小文字に正規化される", () => {
    expect(signupInputSchema.parse(base).loginId).toBe("taro_01");
  });

  it("不正な loginId・短いパスワード・長いニックネームは失敗する", () => {
    expect(
      signupInputSchema.safeParse({ ...base, loginId: "ab" }).success,
    ).toBe(false);
    expect(
      signupInputSchema.safeParse({ ...base, loginId: "a-b-c" }).success,
    ).toBe(false);
    expect(
      signupInputSchema.safeParse({ ...base, password: "short" }).success,
    ).toBe(false);
    expect(
      signupInputSchema.safeParse({ ...base, nickname: "a".repeat(21) })
        .success,
    ).toBe(false);
    expect(signupInputSchema.safeParse({ ...base, nickname: "" }).success).toBe(
      false,
    );
  });
});
