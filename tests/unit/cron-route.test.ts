import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn(async () => ({ updated: 1, failed: 0 })));
vi.mock("@/lib/places/refresh-locations", () => ({
  refreshStaleLocations: refresh,
  createRefreshDeps: () => ({}),
}));

import { GET } from "@/app/api/cron/refresh-locations/route";

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/refresh-locations", {
    headers: auth === undefined ? {} : { authorization: auth },
  });

describe("cron/refresh-locations の認証", () => {
  beforeEach(() => refresh.mockClear());
  afterEach(() => vi.unstubAllEnvs());

  it("CRON_SECRET 未設定なら 500 で実行しない", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(500);
    expect((await GET(req())).status).toBe(500);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("トークンが違えば 401", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req())).status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("一致すれば結果を返す", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 1, failed: 0 });
  });
});
