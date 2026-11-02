import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const autocomplete = vi.fn();
vi.mock("@/lib/places/google", async (orig) => ({
  ...(await orig<typeof import("@/lib/places/google")>()),
  autocomplete: (...a: unknown[]) => autocomplete(...a),
}));

import { GET } from "@/app/api/places/autocomplete/route";
import { PLACES_LIMITS } from "@/lib/places/quota";

describe("Google の使用回数の上限", () => {
  beforeEach(() => {
    rpc.mockReset();
    autocomplete.mockReset();
  });

  it("上限内なら 1 回数えてから Google を呼ぶ", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    autocomplete.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/places/autocomplete?q=abc&session=s"));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("api_usage_hit", {
      p_user: "user-1",
      p_kind: "autocomplete",
      p_user_daily_limit: PLACES_LIMITS.autocomplete.daily,
      p_global_monthly_limit: PLACES_LIMITS.autocomplete.monthly,
    });
    expect(autocomplete).toHaveBeenCalledTimes(1);
  });

  it("上限に達していたら 429 で、Google は呼ばない", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await GET(new Request("http://localhost/api/places/autocomplete?q=abc"));
    expect(res.status).toBe(429);
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it("数えられなかったときも安全側（429）", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await GET(new Request("http://localhost/api/places/autocomplete?q=abc"));
    expect(res.status).toBe(429);
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it("入力が不正なら数えない", async () => {
    const res = await GET(new Request("http://localhost/api/places/autocomplete?q="));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
