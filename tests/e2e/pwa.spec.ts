import { expect, test } from "@playwright/test";

// ログイン状態に依存しない。proxy に除外されていて、リダイレクトされないことを確認する。
test.use({ storageState: { cookies: [], origins: [] } });

for (const path of ["/sw.js", "/manifest.webmanifest"]) {
  test(`${path} は未ログインでも 200 で返り、リダイレクトされない`, async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const res = await ctx.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(new URL(res.url()).pathname).toBe(path);
    await ctx.dispose();
  });
}

test("manifest は standalone で any と maskable のアイコンを持つ", async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL });
  const manifest = await (await ctx.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose).sort();
  expect(purposes).toEqual(["any", "maskable"]);
  await ctx.dispose();
});
