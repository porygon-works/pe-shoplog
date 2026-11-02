import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const claims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { getClaims: claims } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { POST } from "@/app/api/maps/load/route";
import { PLACES_LIMITS } from "@/lib/places/quota";

describe("地図の表示回数（/api/maps/load）", () => {
  beforeEach(() => {
    rpc.mockReset();
    claims.mockReset();
  });

  it("未ログインは 401 で数えない", async () => {
    claims.mockResolvedValue({ data: null });
    expect((await POST()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("上限内なら 200、mapload として数える", async () => {
    claims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await POST()).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("api_usage_hit", {
      p_user: "u1",
      p_kind: "mapload",
      p_user_daily_limit: PLACES_LIMITS.mapload.daily,
      p_global_monthly_limit: PLACES_LIMITS.mapload.monthly,
    });
  });

  it("上限に達していたら 429", async () => {
    claims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST()).status).toBe(429);
  });
});
