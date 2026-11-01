import { describe, expect, it } from "vitest";
import { hashPassphrase, verifyPassphrase } from "@/lib/auth/passphrase";

describe("passphrase", () => {
  it("ignores case and surrounding spaces", async () => {
    const stored = await hashPassphrase("PE");
    expect(stored).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassphrase(" pe ", stored)).toBe(true);
    expect(await verifyPassphrase("PX", stored)).toBe(false);
  });
  it("normalizes full-width characters (NFKC)", async () => {
    const stored = await hashPassphrase("PE");
    expect(await verifyPassphrase("ＰＥ", stored)).toBe(true);
    expect(await verifyPassphrase(" ｐｅ ", stored)).toBe(true);
  });
  it("salts every hash", async () => {
    expect(await hashPassphrase("PE")).not.toBe(await hashPassphrase("PE"));
  });
  it("rejects malformed stored values", async () => {
    expect(await verifyPassphrase("PE", "garbage")).toBe(false);
  });
});
