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

test("manifest は standalone で PNG の any / maskable アイコンを持ち、どれも取得できる", async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL });
  const manifest = await (await ctx.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  type Icon = { src: string; sizes: string; type: string; purpose: string };
  const icons: Icon[] = manifest.icons;
  const find = (sizes: string, purpose: string) =>
    icons.find((i) => i.sizes === sizes && i.purpose === purpose && i.type === "image/png");
  expect(find("192x192", "any")).toBeTruthy();
  expect(find("512x512", "any")).toBeTruthy();
  expect(find("512x512", "maskable")).toBeTruthy();
  expect(icons.some((i) => i.type === "image/svg+xml" && i.purpose === "any")).toBe(true);
  for (const icon of icons) {
    const res = await ctx.get(icon.src, { maxRedirects: 0 });
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toContain(icon.type);
  }
  await ctx.dispose();
});
