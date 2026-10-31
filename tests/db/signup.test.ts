import { beforeAll, describe, expect, it } from "vitest";
import { hashPassphrase } from "@/lib/auth/passphrase";
import { registerUser } from "@/lib/auth/signup";
import { adminClient, uniqueId } from "./helpers";

const admin = adminClient();

function input(loginId: string, passphrase = "pe") {
  return {
    loginId,
    nickname: "テスト太郎",
    password: "password-1234",
    passphrase,
  };
}

function ip() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

beforeAll(async () => {
  const { error } = await admin.from("app_settings").upsert({
    key: "signup_passphrase_hash",
    value: await hashPassphrase("pe"),
  });
  if (error) throw error;
});

describe("registerUser", () => {
  it("正しい合言葉で登録でき、profiles と既定リスト2件ができる", async () => {
    const loginId = uniqueId("s");
    const res = await registerUser(input(loginId, " PE "), ip());
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const profile = await admin
      .from("profiles")
      .select("login_id, nickname, is_admin")
      .eq("id", res.userId)
      .single();
    expect(profile.data).toEqual({
      login_id: loginId,
      nickname: "テスト太郎",
      is_admin: false,
    });

    const lists = await admin
      .from("lists")
      .select("name, kind, is_public, is_default")
      .eq("owner_id", res.userId)
      .order("kind");
    expect(lists.data).toEqual([
      { name: "お気に入り", kind: "favorite", is_public: false, is_default: true },
      { name: "気になる", kind: "want", is_public: false, is_default: true },
    ]);
  });

  it("大文字小文字違いの同じIDは login_id_taken", async () => {
    const base = uniqueId("t");
    const first = await registerUser(input(base), ip());
    expect(first.ok).toBe(true);
    const second = await registerUser(input(base.toUpperCase()), ip());
    expect(second).toEqual({ ok: false, error: "login_id_taken" });
  });

  it("合言葉が違えば bad_passphrase で、auth ユーザーは作られない", async () => {
    const loginId = uniqueId("b");
    const res = await registerUser(input(loginId, "xx"), ip());
    expect(res).toEqual({ ok: false, error: "bad_passphrase" });
    const profile = await admin
      .from("profiles")
      .select("id")
      .eq("login_id", loginId);
    expect(profile.data).toEqual([]);
    const retry = await registerUser(input(loginId, "pe"), ip());
    expect(retry.ok).toBe(true);
  });

  it("同じIPから11回目は rate_limited", async () => {
    const addr = ip();
    for (let i = 0; i < 10; i++) {
      const res = await registerUser(input(uniqueId("r"), "xx"), addr);
      expect(res).toEqual({ ok: false, error: "bad_passphrase" });
    }
    const res = await registerUser(input(uniqueId("r"), "pe"), addr);
    expect(res).toEqual({ ok: false, error: "rate_limited" });
  });

  it("他のIPには影響しない", async () => {
    const res = await registerUser(input(uniqueId("o")), ip());
    expect(res.ok).toBe(true);
  });
});
