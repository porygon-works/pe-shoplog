import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, uniqueId } from "./helpers";

describe("ログインの失敗記録と API の使用回数（0010）", () => {
  it("ログインユーザー・未ログインのどちらからも、記録の表は読めず書けない", async () => {
    const u = await createTestUser(uniqueId("sec"));
    for (const c of [u.client, anonClient()]) {
      const read = await c.from("login_attempts").select("id").limit(1);
      expect(read.error).not.toBeNull();
      const write = await c.from("api_usage").insert({ day: "2026-01-01", user_id: u.id, kind: "x", count: 0 });
      expect(write.error).not.toBeNull();
    }
  });

  it("api_usage_hit はログインユーザーから呼べない", async () => {
    const u = await createTestUser(uniqueId("sec"));
    const { error } = await u.client.rpc("api_usage_hit", {
      p_user: u.id,
      p_kind: "autocomplete",
      p_user_daily_limit: 9999,
      p_global_monthly_limit: 9999,
    });
    expect(error).not.toBeNull();
  });

  it("1 人の 1 日の上限を超えると false になる", async () => {
    const u = await createTestUser(uniqueId("sec"));
    const kind = uniqueId("k");
    const hit = () =>
      adminClient().rpc("api_usage_hit", { p_user: u.id, p_kind: kind, p_user_daily_limit: 2, p_global_monthly_limit: 100 });
    expect((await hit()).data).toBe(true);
    expect((await hit()).data).toBe(true);
    expect((await hit()).data).toBe(false);
  });

  it("全員合計の 1 か月の上限を超えると、別の人でも false になる", async () => {
    const a = await createTestUser(uniqueId("sec"));
    const b = await createTestUser(uniqueId("sec"));
    const kind = uniqueId("k");
    const hit = (id: string) =>
      adminClient().rpc("api_usage_hit", { p_user: id, p_kind: kind, p_user_daily_limit: 100, p_global_monthly_limit: 2 });
    expect((await hit(a.id)).data).toBe(true);
    expect((await hit(b.id)).data).toBe(true);
    expect((await hit(b.id)).data).toBe(false);
  });

  it("トリガー用の関数は API から直接呼べない", async () => {
    const u = await createTestUser(uniqueId("sec"));
    const { error } = await u.client.rpc("shops_validate_categories");
    expect(error).not.toBeNull();
  });
});
