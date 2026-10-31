import { describe, expect, it } from "vitest";
import { ensureShopInDefaultList } from "@/lib/lists/default-list";
import { adminClient, createShop, createTestUser, uniqueId } from "./helpers";

describe("ensureShopInDefaultList", () => {
  it("削除済みの店は既定のリストに入れない", async () => {
    const u = await createTestUser(uniqueId("dl"));
    const admin = adminClient();
    const ins = await admin
      .from("lists")
      .insert({ owner_id: u.id, name: "気になる", kind: "want", is_default: true });
    if (ins.error) throw ins.error;
    const live = await createShop(u.id);
    const gone = await createShop(u.id);
    await admin.from("shops").update({ deleted_at: new Date().toISOString() }).eq("id", gone);

    expect(await ensureShopInDefaultList(u.client, u.id, gone, "want")).toBe("shop_missing");
    const rows = await admin.from("list_items").select("id").eq("shop_id", gone);
    expect(rows.data).toEqual([]);

    expect(await ensureShopInDefaultList(u.client, u.id, live, "want")).toBe("added");
    expect(await ensureShopInDefaultList(u.client, u.id, live, "want")).toBe("present");
  });
});
