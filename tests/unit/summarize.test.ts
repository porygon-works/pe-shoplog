import { describe, expect, it } from "vitest";
import { summarizeVisits, type VisitLike } from "@/lib/visits/summarize";

const visit = (o: Partial<VisitLike> = {}): VisitLike => ({
  smoking: "unknown",
  priceRange: "unknown",
  purpose: "unknown",
  reservation: "unknown",
  paymentMethods: [],
  partySize: null,
  ...o,
});

describe("summarizeVisits", () => {
  it("件数の多い順で unknown を除外する", () => {
    const b = summarizeVisits([
      visit({ purpose: "celebration" }),
      visit({ purpose: "team_meeting" }),
      visit({ purpose: "celebration" }),
      visit({ purpose: "unknown" }),
    ]);
    expect(b.purpose).toEqual([
      { value: "celebration", count: 2 },
      { value: "team_meeting", count: 1 },
    ]);
  });

  it("支払方法は配列を展開して数える", () => {
    const b = summarizeVisits([
      visit({ paymentMethods: ["qr", "credit_card"] }),
      visit({ paymentMethods: ["qr"] }),
    ]);
    expect(b.paymentMethods).toEqual([
      { value: "qr", count: 2 },
      { value: "credit_card", count: 1 },
    ]);
  });

  it("maxPartySize は最大値、全件 null なら null", () => {
    expect(
      summarizeVisits([
        visit({ partySize: 4 }),
        visit({ partySize: 12 }),
        visit(),
      ]).maxPartySize,
    ).toBe(12);
    expect(summarizeVisits([visit(), visit()]).maxPartySize).toBeNull();
    expect(summarizeVisits([]).maxPartySize).toBeNull();
  });
});
