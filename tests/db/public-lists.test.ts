import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listPublicLists } from "@/lib/filters/public-list-filters";
import { adminClient, createShop, createTestUser, uniqueId } from "./helpers";

type U = { id: string; client: SupabaseClient };
let a: U, b: U;
let tag: string;
const ids: Record<string, string> = {};

async function personal(name: string, isPublic: boolean, shops: string[]): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("lists")
    .insert({ owner_id: a.id, name, kind: "favorite", is_public: isPublic })
    .select("id")
    .single();
  if (error) throw error;
  if (shops.length) {
    const r = await admin.from("list_items").insert(shops.map((s) => ({ list_id: data.id, shop_id: s })));
    if (r.error) throw r.error;
  }
  return data.id as string;
}

async function shared(name: string, isPublic: boolean, shops: string[]): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("shared_lists")
    .insert({ owner_id: a.id, name, is_public: isPublic })
    .select("id")
    .single();
  if (error) throw error;
  if (shops.length) {
    const r = await admin
      .from("shared_list_items")
      .insert(shops.map((s) => ({ shared_list_id: data.id, shop_id: s, added_by: a.id })));
    if (r.error) throw r.error;
  }
  return data.id as string;
}

beforeAll(async () => {
  a = await createTestUser(uniqueId("a"));
  b = await createTestUser(uniqueId("b"));
  tag = uniqueId("pl");
  const s1 = await createShop(a.id);
  const s2 = await createShop(a.id);
  const s3 = await createShop(a.id);
  ids.pubPersonal = await personal(`${tag}-公開マイ`, true, [s1]);
  ids.privPersonal = await personal(`${tag}-非公開マイ`, false, [s1]);
  ids.pubShared = await shared(`${tag}-公開共有`, true, [s1, s2, s3]);
  ids.privShared = await shared(`${tag}-非公開共有`, false, [s1]);
  ids.percent = await personal(`${tag}-100%引き`, true, []);
  ids.other = await personal(`${tag}-1000円`, true, [s2, s3]);
});

describe("listPublicLists", () => {
  it("B から A の公開リスト（マイ・共有）だけが見える", async () => {
    const rows = await listPublicLists(b.client, { q: tag, sort: "updated" });
    const got = new Set(rows.map((r) => r.id));
    expect(got.has(ids.pubPersonal)).toBe(true);
    expect(got.has(ids.pubShared)).toBe(true);
    expect(got.has(ids.privPersonal)).toBe(false);
    expect(got.has(ids.privShared)).toBe(false);
    expect(rows.find((r) => r.id === ids.pubPersonal)?.kind).toBe("personal");
    expect(rows.find((r) => r.id === ids.pubShared)?.kind).toBe("shared");
  });

  it("shop_count の多い順に並べ替えると件数の降順になる", async () => {
    const rows = await listPublicLists(b.client, { q: tag, sort: "count" });
    const counts = rows.map((r) => r.shop_count);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));
    expect(rows[0].id).toBe(ids.pubShared);
    expect(rows[0].shop_count).toBe(3);
  });

  it("更新順は updated_at の降順", async () => {
    const rows = await listPublicLists(b.client, { q: tag, sort: "updated" });
    const times = rows.map((r) => new Date(r.updated_at).getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });

  it("名前検索の % はワイルドカードにならない", async () => {
    const rows = await listPublicLists(b.client, { q: `${tag}-100%`, sort: "updated" });
    expect(rows.map((r) => r.id)).toEqual([ids.percent]);
  });
});
