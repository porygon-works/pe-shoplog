import { expect, test, type Page } from "@playwright/test";
import { createShop, createTestUser, createVisit, TEST_PASSWORD, uniqueId } from "../db/helpers";

test("管理者以外は /admin が 404", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});

test.describe("管理者", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  async function loginAs(page: Page, loginId: string) {
    await page.goto("/login");
    await page.getByLabel("ユーザーID").fill(loginId);
    await page.getByLabel("パスワード").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/map$/);
  }

  test("ユーザー一覧が見え、停止 → 再開できる。他人の記録を削除できる", async ({ page }) => {
    const adminId = uniqueId("adm");
    await createTestUser(adminId, { admin: true });
    const targetId = uniqueId("tgt");
    const target = await createTestUser(targetId);
    const shop = await createShop(target.id, { name: "管理者削除テスト店" });
    await createVisit(shop, target.id, { comment: "消される記録" });

    await loginAs(page, adminId);
    await page.goto("/admin");
    const row = page.getByTestId("admin-user").filter({ hasText: `@${targetId}` });
    await expect(row).toBeVisible();
    await expect(page.getByTestId("admin-user").filter({ hasText: `@${adminId}` })).toContainText("管理者");

    await row.getByRole("button", { name: "停止", exact: true }).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(row).toContainText("停止中");
    await row.getByRole("button", { name: "再開" }).click();
    await expect(row).not.toContainText("停止中");

    await page.goto(`/shops/${shop}`);
    await expect(page.getByText("消される記録")).toBeVisible();
    await page.getByRole("button", { name: "削除（管理者）" }).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText("消される記録")).toHaveCount(0);
  });
});
