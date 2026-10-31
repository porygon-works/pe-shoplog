import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createShop, createTestUser, createVisit, uniqueId } from "./helpers";

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

const path = (visit: string) => `shops/${shop}/visits/${visit}/${randomUUID()}.jpg`;

describe("photos バケット", () => {
  it("A は自分の visit のパスにアップロードでき、ログイン済みなら署名 URL を発行できる", async () => {
    const p = path(aVisit);
    const up = await a.client.storage.from("photos").upload(p, body, { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
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
    const byB = await b.client.storage.from("photos").remove([p]);
    expect(byB.data ?? []).toHaveLength(0);
    const byA = await a.client.storage.from("photos").remove([p]);
    expect(byA.data).toHaveLength(1);
  });
});
