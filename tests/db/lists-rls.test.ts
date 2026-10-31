import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, createShop, createTestUser, uniqueId } from "./helpers";

type U = { id: string; client: SupabaseClient };
let a: U, b: U;

beforeAll(async () => {
  a = await createTestUser(uniqueId("a"));
  b = await createTestUser(uniqueId("b"));
});

async function createList(u: U, isPublic: boolean): Promise<string> {
  const { data, error } = await u.client
    .from("lists")
    .insert({
      owner_id: u.id,
      name: `list-${uniqueId()}`,
      kind: "want",
      is_public: isPublic,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function createShared(u: U, isPublic = false): Promise<string> {
  const { data, error } = await u.client
    .from("shared_lists")
    .insert({ owner_id: u.id, name: `shared-${uniqueId()}`, is_public: isPublic })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function tokenOf(listId: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("shared_lists")
    .select("invite_token")
    .eq("id", listId)
    .single();
  if (error) throw error;
  return data.invite_token as string;
}

describe("マイリスト", () => {
  it("B は A の非公開リストとその items を見られず、公開リストは見られる", async () => {
    const priv = await createList(a, false);
    const pub = await createList(a, true);
    const shop = await createShop(a.id);
    for (const list of [priv, pub]) {
      const { error } = await a.client
        .from("list_items")
        .insert({ list_id: list, shop_id: shop });
      expect(error).toBeNull();
    }

    const lists = await b.client.from("lists").select("id").in("id", [priv, pub]);
    expect((lists.data ?? []).map((r) => r.id)).toEqual([pub]);

    const items = await b.client
      .from("list_items")
      .select("list_id")
      .in("list_id", [priv, pub]);
    expect((items.data ?? []).map((r) => r.list_id)).toEqual([pub]);

    const anon = await anonClient().from("lists").select("id");
    expect(anon.data ?? []).toHaveLength(0);
  });

  it("B は A のリストに items を追加・リストを更新・削除できない", async () => {
    const pub = await createList(a, true);
    const shop = await createShop(a.id);
    const ins = await b.client
      .from("list_items")
      .insert({ list_id: pub, shop_id: shop });
    expect(ins.error).not.toBeNull();
    const upd = await b.client
      .from("lists")
      .update({ name: "x" })
      .eq("id", pub)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const del = await b.client.from("lists").delete().eq("id", pub).select("id");
    expect(del.data ?? []).toHaveLength(0);
  });

  it("同じ店を同じリストに 2 回入れると 23505", async () => {
    const list = await createList(a, false);
    const shop = await createShop(a.id);
    await a.client.from("list_items").insert({ list_id: list, shop_id: shop });
    const { error } = await a.client
      .from("list_items")
      .insert({ list_id: list, shop_id: shop });
    expect(error?.code).toBe("23505");
  });
});

describe("共有リスト", () => {
  it("作成者は owner メンバーになる", async () => {
    const list = await createShared(a);
    const { data } = await a.client
      .from("shared_list_members")
      .select("user_id, role")
      .eq("shared_list_id", list);
    expect(data).toEqual([{ user_id: a.id, role: "owner" }]);
  });

  it("非公開の共有リストは非メンバーに見えず、公開なら見える。招待トークンは誰も select できない", async () => {
    const priv = await createShared(a, false);
    const pub = await createShared(a, true);
    const seen = await b.client.from("shared_lists").select("id").in("id", [priv, pub]);
    expect((seen.data ?? []).map((r) => r.id)).toEqual([pub]);
    const tok = await a.client.from("shared_lists").select("invite_token").eq("id", pub);
    expect(tok.error).not.toBeNull();
    const star = await b.client.from("shared_lists").select("*").eq("id", pub);
    expect(star.error).not.toBeNull();
  });

  it("join_shared_list で参加でき、再実行しても同じ id が返る", async () => {
    const list = await createShared(a);
    const token = await tokenOf(list);
    const first = await b.client.rpc("join_shared_list", { p_token: token });
    expect(first.error).toBeNull();
    expect(first.data).toBe(list);
    const second = await b.client.rpc("join_shared_list", { p_token: token });
    expect(second.error).toBeNull();
    expect(second.data).toBe(list);

    const { data } = await b.client
      .from("shared_list_members")
      .select("user_id, role")
      .eq("shared_list_id", list)
      .order("role");
    expect(data).toHaveLength(2);
    expect(data).toContainEqual({ user_id: b.id, role: "member" });
    // 再参加しても owner の役割は変わらない
    const again = await a.client.rpc("join_shared_list", { p_token: token });
    expect(again.data).toBe(list);
    const owner = await adminClient()
      .from("shared_list_members")
      .select("role")
      .eq("shared_list_id", list)
      .eq("user_id", a.id)
      .single();
    expect(owner.data?.role).toBe("owner");
  });

  it("一致しないトークンは invalid_invite", async () => {
    const { error } = await b.client.rpc("join_shared_list", { p_token: "nope" });
    expect(error?.message).toContain("invalid_invite");
  });

  it("参加前の B は items を insert できず、参加後はできる", async () => {
    const list = await createShared(a);
    const shop = await createShop(a.id);
    const before = await b.client
      .from("shared_list_items")
      .insert({ shared_list_id: list, shop_id: shop, added_by: b.id });
    expect(before.error).not.toBeNull();

    await b.client.rpc("join_shared_list", { p_token: await tokenOf(list) });
    const after = await b.client
      .from("shared_list_items")
      .insert({ shared_list_id: list, shop_id: shop, added_by: b.id, note: "n" });
    expect(after.error).toBeNull();

    // added_by の詐称は不可
    const shop2 = await createShop(a.id);
    const spoof = await b.client
      .from("shared_list_items")
      .insert({ shared_list_id: list, shop_id: shop2, added_by: a.id });
    expect(spoof.error).not.toBeNull();

    // メンバーは items を読める
    const read = await a.client
      .from("shared_list_items")
      .select("shop_id")
      .eq("shared_list_id", list);
    expect(read.data).toHaveLength(1);
  });

  it("非メンバーは非公開リストの items を読めない", async () => {
    const list = await createShared(a);
    const shop = await createShop(a.id);
    await a.client
      .from("shared_list_items")
      .insert({ shared_list_id: list, shop_id: shop, added_by: a.id });
    const { data } = await b.client
      .from("shared_list_items")
      .select("shop_id")
      .eq("shared_list_id", list);
    expect(data ?? []).toHaveLength(0);
  });

  it("古いトークンでの参加は invalid_invite で失敗する", async () => {
    const list = await createShared(a);
    const old = await tokenOf(list);
    const regen = await a.client.rpc("regenerate_invite_token", { p_list: list });
    expect(regen.error).toBeNull();
    expect(regen.data).toMatch(/^[0-9a-f]{32}$/);
    expect(regen.data).not.toBe(old);
    const { error } = await b.client.rpc("join_shared_list", { p_token: old });
    expect(error?.message).toContain("invalid_invite");
    const ok = await b.client.rpc("join_shared_list", { p_token: regen.data });
    expect(ok.data).toBe(list);
  });

  it("owner 以外は regenerate_invite_token を実行できない", async () => {
    const list = await createShared(a);
    await b.client.rpc("join_shared_list", { p_token: await tokenOf(list) });
    const { error } = await b.client.rpc("regenerate_invite_token", { p_list: list });
    expect(error).not.toBeNull();
  });

  it("メンバーは get_invite_token を呼べ、非メンバーは呼べない", async () => {
    const list = await createShared(a);
    const token = await tokenOf(list);
    const ok = await a.client.rpc("get_invite_token", { p_list: list });
    expect(ok.data).toBe(token);
    const denied = await b.client.rpc("get_invite_token", { p_list: list });
    expect(denied.error).not.toBeNull();
  });

  it("B はリスト本体を update できず、owner の A はできる", async () => {
    const list = await createShared(a);
    await b.client.rpc("join_shared_list", { p_token: await tokenOf(list) });
    const byB = await b.client
      .from("shared_lists")
      .update({ name: "hacked" })
      .eq("id", list)
      .select("id");
    expect(byB.data ?? []).toHaveLength(0);
    const byA = await a.client
      .from("shared_lists")
      .update({ name: "renamed" })
      .eq("id", list)
      .select("id");
    expect(byA.data).toHaveLength(1);
  });

  it("invite_token は update できない", async () => {
    const list = await createShared(a);
    const { error } = await a.client
      .from("shared_lists")
      .update({ invite_token: "mine" })
      .eq("id", list);
    expect(error).not.toBeNull();
  });

  it("invite_token を指定した insert は失敗する", async () => {
    const { error } = await a.client
      .from("shared_lists")
      .insert({ owner_id: a.id, name: "x", invite_token: "chosen" });
    expect(error).not.toBeNull();
  });

  it("オーナーの退会: 他メンバーがいれば最古参加者が owner になり、いなければリストごと消える", async () => {
    const o = await createTestUser(uniqueId("o"));
    const m1 = await createTestUser(uniqueId("m"));
    const m2 = await createTestUser(uniqueId("m"));
    const withMembers = await createShared(o);
    const alone = await createShared(o);
    const shop = await createShop(o.id);
    await o.client
      .from("shared_list_items")
      .insert({ shared_list_id: withMembers, shop_id: shop, added_by: o.id });
    const token = await tokenOf(withMembers);
    await m1.client.rpc("join_shared_list", { p_token: token });
    await new Promise((r) => setTimeout(r, 20));
    await m2.client.rpc("join_shared_list", { p_token: token });

    const del = await adminClient().auth.admin.deleteUser(o.id);
    expect(del.error).toBeNull();

    const list = await adminClient()
      .from("shared_lists")
      .select("owner_id")
      .eq("id", withMembers)
      .single();
    expect(list.data?.owner_id).toBe(m1.id);
    const members = await adminClient()
      .from("shared_list_members")
      .select("user_id, role")
      .eq("shared_list_id", withMembers);
    expect(members.data).toHaveLength(2);
    expect(members.data).toContainEqual({ user_id: m1.id, role: "owner" });
    expect(members.data).toContainEqual({ user_id: m2.id, role: "member" });
    const items = await adminClient()
      .from("shared_list_items")
      .select("added_by")
      .eq("shared_list_id", withMembers);
    expect(items.data).toEqual([{ added_by: null }]);

    const gone = await adminClient().from("shared_lists").select("id").eq("id", alone);
    expect(gone.data).toHaveLength(0);
  });

  it("メンバーは直接 insert でメンバーになれない", async () => {
    const list = await createShared(a);
    const { error } = await b.client
      .from("shared_list_members")
      .insert({ shared_list_id: list, user_id: b.id, role: "member" });
    expect(error).not.toBeNull();
  });

  it("A は B をメンバーから外せ、B は自分で抜けられる。B は他人を外せない", async () => {
    const list = await createShared(a);
    const token = await tokenOf(list);
    await b.client.rpc("join_shared_list", { p_token: token });
    const kickByB = await b.client
      .from("shared_list_members")
      .delete()
      .eq("shared_list_id", list)
      .eq("user_id", a.id)
      .select("user_id");
    expect(kickByB.data ?? []).toHaveLength(0);

    const kick = await a.client
      .from("shared_list_members")
      .delete()
      .eq("shared_list_id", list)
      .eq("user_id", b.id)
      .select("user_id");
    expect(kick.data).toHaveLength(1);

    await b.client.rpc("join_shared_list", { p_token: token });
    const leave = await b.client
      .from("shared_list_members")
      .delete()
      .eq("shared_list_id", list)
      .eq("user_id", b.id)
      .select("user_id");
    expect(leave.data).toHaveLength(1);
  });
});

describe("get_invite_preview", () => {
  it("有効なトークンなら行を返し、トークン自体は含めない。参加後は is_member になる", async () => {
    const list = await createShared(a);
    const token = await tokenOf(list);
    const shop = await createShop(a.id);
    const deletedShop = await createShop(a.id, { deleted_at: new Date().toISOString() });
    await adminClient()
      .from("shared_list_items")
      .insert([
        { shared_list_id: list, shop_id: shop, added_by: a.id },
        { shared_list_id: list, shop_id: deletedShop, added_by: a.id },
      ]);

    const before = await b.client.rpc("get_invite_preview", { p_token: token });
    expect(before.error).toBeNull();
    expect(before.data).toHaveLength(1);
    const row = before.data[0];
    expect(row.id).toBe(list);
    expect(Number(row.member_count)).toBe(1);
    expect(Number(row.shop_count)).toBe(1);
    expect(row.is_member).toBe(false);
    expect(JSON.stringify(row)).not.toContain(token);

    await b.client.rpc("join_shared_list", { p_token: token });
    const after = await b.client.rpc("get_invite_preview", { p_token: token });
    expect(after.data[0].is_member).toBe(true);
    expect(Number(after.data[0].member_count)).toBe(2);
  });

  it("無効なトークンなら空", async () => {
    const res = await b.client.rpc("get_invite_preview", { p_token: "no-such-token" });
    expect(res.error).toBeNull();
    expect(res.data).toEqual([]);
  });

  it("anon は実行できない", async () => {
    const list = await createShared(a);
    const res = await anonClient().rpc("get_invite_preview", { p_token: await tokenOf(list) });
    expect(res.error).not.toBeNull();
  });
});
