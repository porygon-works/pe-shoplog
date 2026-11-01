import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getClaims: async () => ({ data: null }) },
  }),
}));

import { GET as autocompleteGET } from "@/app/api/places/autocomplete/route";
import { GET as detailsGET } from "@/app/api/places/details/route";
import { GET as photoGET } from "@/app/api/places/photo/route";
import { GET as websiteGET } from "@/app/api/places/website/route";

describe("Places Route Handler の認証", () => {
  it.each([
    ["autocomplete", autocompleteGET, "q=abc"],
    ["details", detailsGET, "id=p1"],
    ["website", websiteGET, "id=p1"],
    ["photo", photoGET, "id=p1"],
  ])("%s は未ログインなら 401", async (_n, handler, qs) => {
    const res = await handler(new Request(`http://localhost/api/places/x?${qs}`));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});
