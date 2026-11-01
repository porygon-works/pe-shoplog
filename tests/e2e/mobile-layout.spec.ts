import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createShop, createTestUser, createVisit, uniqueId } from "../db/helpers";

// iPhone 15 のプロファイル（project "iphone"）で、主要画面が画面幅に収まることを確認する。
const SCREENS = "test-results/screens";

test("iPhone 15 表示: 主要画面が横にはみ出さず、下部タブが見える", async ({ page }) => {
  test.setTimeout(60_000); // 開発サーバーの初回コンパイルが 5 画面分かかる
  mkdirSync(SCREENS, { recursive: true });
  const user = await createTestUser(uniqueId("e2e"));
  const shopId = await createShop(user.id, { name: "スマホ表示確認酒場" });
  await createVisit(shopId, user.id, { comment: "スマホ表示のコメント" });

  const screens: [string, string][] = [
    ["map", "/map"],
    ["search", "/search"],
    ["shop", `/shops/${shopId}`],
    ["visit-form", `/shops/${shopId}/visits/new`],
    ["me", "/me"],
  ];
  for (const [name, url] of screens) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SCREENS}/${name}.png`, fullPage: true });
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth, `${name} が横にはみ出している`).toBeLessThanOrEqual(overflow.innerWidth);
  }

  // 下部タブと記録フォームの送信ボタンが画面幅の内側にある
  await page.goto(`/shops/${shopId}/visits/new`);
  const vw = page.viewportSize()!.width;
  for (const el of [page.getByRole("navigation").last(), page.getByRole("button", { name: "記録を保存" })]) {
    const box = await el.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  }
});
