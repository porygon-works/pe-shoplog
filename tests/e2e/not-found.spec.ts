import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("存在しない店のページは日本語の 404 で、マップへ戻るリンクと下部タブがある", async ({ page }) => {
  // loading.tsx があると応答を先に流し始めるので、HTTP ステータスは 200 のまま 404 画面が出る（Next.js の仕様）。
  await page.goto(`/shops/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await expect(page.getByText("削除されたか、見る権限がない可能性があります")).toBeVisible();
  const link = page.getByRole("link", { name: "マップへ" });
  await expect(link).toHaveAttribute("href", "/map");
  await expect(page.getByRole("navigation")).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/map$/);
});
