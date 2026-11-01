import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, createShop, createTestUser, createVisit, uniqueId } from "./helpers";

type U = { id: string; client: SupabaseClient };
let a: U, b: U;
let shop: string, aVisit: string, bVisit: string;
const body = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
  type: "image/jpeg",
});

beforeAll(async () => {
  a = await createTestUser(uniqueId("a"));
  b = await createTestUser(uniqueId("b"));
  shop = await createShop(a.id);
  aVisit = await createVisit(shop, a.id);
  bVisit = await createVisit(shop, b.id);
});

const admin = adminClient();

/** 生きている写真行を作る（Storage の SELECT / DELETE ポリシーの前提）。 */
async function addPhotoRow(visit: string, userId: string, p: string): Promise<string> {
  const { data, error } = await admin
    .from("photos")
    .insert({ visit_id: visit, shop_id: shop, user_id: userId, storage_path: p })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const path = (visit: string) => `shops/${shop}/visits/${visit}/${randomUUID()}.jpg`;

describe("photos バケット", () => {
  it("A は自分の visit のパスにアップロードでき、ログイン済みなら署名 URL を発行できる", async () => {
    const p = path(aVisit);
    const up = await a.client.storage.from("photos").upload(p, body, { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    await addPhotoRow(aVisit, a.id, p);
    const signed = await b.client.storage.from("photos").createSignedUrl(p, 3600);
    expect(signed.error).toBeNull();
    expect(signed.data?.signedUrl).toContain("token=");
  });

  it("A は B の visit のパスにアップロードできない", async () => {
    const up = await a.client.storage
      .from("photos")
      .upload(path(bVisit), body, { contentType: "image/jpeg" });
    expect(up.error).not.toBeNull();
  });

  it("不正なパスにはアップロードできない", async () => {
    const up = await a.client.storage
      .from("photos")
      .upload(`junk/${randomUUID()}.jpg`, body, { contentType: "image/jpeg" });
    expect(up.error).not.toBeNull();
  });

  it("未ログインは署名 URL を発行できず、アップロードもできない", async () => {
    const p = path(aVisit);
    await a.client.storage.from("photos").upload(p, body, { contentType: "image/jpeg" });
    await addPhotoRow(aVisit, a.id, p);
    const anon = anonClient();
    const signed = await anon.storage.from("photos").createSignedUrl(p, 3600);
    expect(signed.error).not.toBeNull();
    const up = await anon.storage
      .from("photos")
      .upload(path(aVisit), body, { contentType: "image/jpeg" });
    expect(up.error).not.toBeNull();
  });

  it("B は A のファイルを削除できない。A は自分のファイルを削除できる", async () => {
    const p = path(aVisit);
    await a.client.storage.from("photos").upload(p, body, { contentType: "image/jpeg" });
    await addPhotoRow(aVisit, a.id, p);
    const byB = await b.client.storage.from("photos").remove([p]);
    expect(byB.data ?? []).toHaveLength(0);
    const byA = await a.client.storage.from("photos").remove([p]);
    expect(byA.data).toHaveLength(1);
  });

  it("写真行が無いオブジェクト（アップロード直後・行の作成前）は他人から読めない", async () => {
    const p = path(aVisit);
    await a.client.storage.from("photos").upload(p, body, { contentType: "image/jpeg" });
    const signed = await b.client.storage.from("photos").createSignedUrl(p, 3600);
    expect(signed.error).not.toBeNull();
  });

  it("写真を論理削除すると、他のユーザーは署名 URL を発行できない", async () => {
    const p = path(aVisit);
    await a.client.storage.from("photos").upload(p, body, { contentType: "image/jpeg" });
    const photoId = await addPhotoRow(aVisit, a.id, p);
    expect((await b.client.storage.from("photos").createSignedUrl(p, 3600)).error).toBeNull();
    await admin.from("photos").update({ deleted_at: new Date().toISOString() }).eq("id", photoId);
    const after = await b.client.storage.from("photos").createSignedUrl(p, 3600);
    expect(after.error).not.toBeNull();
    const dl = await b.client.storage.from("photos").download(p);
    expect(dl.error).not.toBeNull();
  });

  it("記録を論理削除すると、その写真は他のユーザーから読めなくなる", async () => {
    const visit = await createVisit(shop, a.id);
    const p = path(visit);
    await a.client.storage.from("photos").upload(p, body, { contentType: "image/jpeg" });
    await addPhotoRow(visit, a.id, p);
    expect((await b.client.storage.from("photos").createSignedUrl(p, 3600)).error).toBeNull();
    await admin.from("visits").update({ deleted_at: new Date().toISOString() }).eq("id", visit);
    const after = await b.client.storage.from("photos").createSignedUrl(p, 3600);
    expect(after.error).not.toBeNull();
    const dl = await b.client.storage.from("photos").download(p);
    expect(dl.error).not.toBeNull();
  });
});
