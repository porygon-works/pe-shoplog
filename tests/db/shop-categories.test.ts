import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, createShop, createTestUser, uniqueId } from "./helpers";

const svc = adminClient();

let member: Awaited<ReturnType<typeof createTestUser>>;
let adm: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  member = await createTestUser(uniqueId("cm"));
  adm = await createTestUser(uniqueId("ca"), { admin: true });
});

/** value は `^[a-z0-9_]{1,40}$` なので、テスト用にその形で一意な値を作る。 */
const val = () => `t_${uniqueId("")}`;

async function seedCategory(kind: "genre" | "style", extra: Record<string, unknown> = {}) {
  const value = val();
  const { error } = await svc.from("shop_categories").insert({ kind, value, label: "テスト", ...extra });
  if (error) throw error;
  return value;
}

describe("shop_categories の種データ", () => {
  it("既存のジャンル 16 件・形態 8 件が入っている", async () => {
    const { data, error } = await member.client.from("shop_categories").select("kind, value, label");
    expect(error).toBeNull();
    const genres = (data ?? []).filter((r) => r.kind === "genre").map((r) => r.value);
    const styles = (data ?? []).filter((r) => r.kind === "style").map((r) => r.value);
    expect(genres).toEqual(expect.arrayContaining(["washoku", "ramen", "other", "unknown"]));
    expect(styles).toEqual(expect.arrayContaining(["taishu_izakaya", "karaoke", "other"]));
    expect(data?.find((r) => r.kind === "genre" && r.value === "washoku")?.label).toBe("和食");
  });
});

describe("shop_categories の RLS", () => {
  it("一般ユーザーは insert できない", async () => {
    const { error } = await member.client
      .from("shop_categories")
      .insert({ kind: "genre", value: val(), label: "不正" });
    expect(error?.code).toBe("42501");
  });

  it("一般ユーザーは update できない（0 行）", async () => {
    const value = await seedCategory("genre");
    const { data, error } = await member.client
      .from("shop_categories")
      .update({ label: "改ざん" })
      .eq("value", value)
      .select("value");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
    const { data: row } = await svc.from("shop_categories").select("label").eq("value", value).single();
    expect(row?.label).toBe("テスト");
  });

  it("管理者は insert / update できる", async () => {
    const value = val();
    const ins = await adm.client.from("shop_categories").insert({ kind: "style", value, label: "追加" });
    expect(ins.error).toBeNull();
    const upd = await adm.client
      .from("shop_categories")
      .update({ label: "改名", hidden: true })
      .eq("value", value)
      .select("label, hidden");
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([{ label: "改名", hidden: true }]);
  });

  it("管理者でも delete はできない（0 行）", async () => {
    const value = await seedCategory("genre");
    const { data } = await adm.client.from("shop_categories").delete().eq("value", value).select("value");
    expect(data ?? []).toHaveLength(0);
    const { data: row } = await svc.from("shop_categories").select("value").eq("value", value);
    expect(row).toHaveLength(1);
  });

  it("制約: value の形式・表示名の長さ・genre の unknown は隠せない", async () => {
    const bad = (v: Record<string, unknown>) =>
      svc.from("shop_categories").insert({ kind: "genre", value: val(), label: "x", ...v });
    expect((await bad({ value: "Bad-Value" })).error?.code).toBe("23514");
    expect((await bad({ label: "  " })).error?.code).toBe("23514");
    expect((await bad({ label: "あ".repeat(21) })).error?.code).toBe("23514");
    const hide = await svc
      .from("shop_categories")
      .update({ hidden: true })
      .eq("kind", "genre")
      .eq("value", "unknown");
    expect(hide.error?.code).toBe("23514");
  });
});

describe("shops の区分検証トリガー", () => {
  it("存在しない genre / style の店は insert できない", async () => {
    const g = await svc.from("shops").insert({ name: "x", lat: 1, lng: 1, genre: "nonsense" });
    expect(g.error?.code).toBe("23514");
    const s = await svc.from("shops").insert({ name: "x", lat: 1, lng: 1, styles: ["bar", "nonsense"] });
    expect(s.error?.code).toBe("23514");
    // genre と style は別の種類。style の value を genre には使えない。
    const mix = await svc.from("shops").insert({ name: "x", lat: 1, lng: 1, genre: "taishu_izakaya" });
    expect(mix.error?.code).toBe("23514");
  });

  it("存在しない値への update も拒否される", async () => {
    const shop = await createShop(member.id);
    const { error } = await member.client.from("shops").update({ genre: "nonsense" }).eq("id", shop);
    expect(error?.code).toBe("23514");
  });

  it("管理画面で追加した区分は使える", async () => {
    const g = await seedCategory("genre");
    const s = await seedCategory("style");
    const shop = await createShop(member.id, { genre: g, styles: [s, "bar"] });
    const { data } = await svc.from("shops").select("genre, styles").eq("id", shop).single();
    expect(data).toEqual({ genre: g, styles: [s, "bar"] });
  });

  it("非表示の区分でも、既存の店はそのまま保持・更新できる", async () => {
    const g = await seedCategory("genre");
    const s = await seedCategory("style");
    const shop = await createShop(member.id, { genre: g, styles: [s] });
    await svc.from("shop_categories").update({ hidden: true }).in("value", [g, s]);

    const { data, error } = await member.client
      .from("shops")
      .update({ name: "改名後", genre: g, styles: [s] })
      .eq("id", shop)
      .select("genre, styles");
    expect(error).toBeNull();
    expect(data).toEqual([{ genre: g, styles: [s] }]);
  });
});

describe("ジャンルの複数選択（0011）", () => {
  it("genres に複数入れられ、genre は先頭にそろう。不明・存在しない値は入れられない", async () => {
    const { data, error } = await svc
      .from("shops")
      .insert({ name: "複数ジャンル", lat: 1, lng: 1, genres: ["ramen", "chinese"] })
      .select("id, genre, genres")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ genre: "ramen", genres: ["ramen", "chinese"] });

    const empty = await svc.from("shops").update({ genres: [] }).eq("id", data!.id).select("genre, genres").single();
    expect(empty.data).toEqual({ genre: "unknown", genres: [] });

    expect((await svc.from("shops").insert({ name: "x", lat: 1, lng: 1, genres: ["unknown"] })).error?.code).toBe("23514");
    expect((await svc.from("shops").insert({ name: "x", lat: 1, lng: 1, genres: ["ramen", "nonsense"] })).error?.code).toBe(
      "23514",
    );
  });

  it("genre だけを書く古い書き込みは genres に反映される", async () => {
    const { data } = await svc.from("shops").insert({ name: "旧形式", lat: 1, lng: 1, genre: "sushi_seafood" }).select("id, genres").single();
    expect(data?.genres).toEqual(["sushi_seafood"]);
    const upd = await svc.from("shops").update({ genre: "unknown" }).eq("id", data!.id).select("genres").single();
    expect(upd.data?.genres).toEqual([]);
  });
});
