import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createTestUser, TEST_PASSWORD, uniqueId } from "../db/helpers";

test("管理者以外は /admin/categories が 404", async ({ page }) => {
  const res = await page.goto("/admin/categories");
  expect(res?.status()).toBe(404);
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

  async function openNewForm(page: Page, placeId: string, shopName: string) {
    await page.route("**/api/places/autocomplete**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ suggestions: [{ placeId, mainText: shopName, secondaryText: "東京都" }] }),
      }),
    );
    await page.route("**/api/places/details**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ placeId, name: shopName, lat: 35.6, lng: 139.7 }),
      }),
    );
    await page.goto("/new");
    await page.getByLabel("店名でさがす").fill("テスト");
    await page.getByRole("button", { name: new RegExp(shopName) }).click();
    await expect(page.getByLabel("店名（必須）")).toHaveValue(shopName);
  }

  test("ジャンルを追加 → /new に出る → 登録した店に表示名が出る → 非表示で /new から消える", async ({ page }) => {
    const adminId = uniqueId("adm");
    await createTestUser(adminId, { admin: true });
    const label = `新ジャンル${randomUUID().slice(0, 6)}`;
    const shopName = `区分テスト店${randomUUID().slice(0, 6)}`;

    await loginAs(page, adminId);
    await page.goto("/admin");
    await page.getByRole("link", { name: "ジャンル・形態の編集" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);

    const genres = page.getByTestId("category-section-genre");
    await expect(genres.getByTestId("category-row").filter({ hasText: "0店" }).first()).toBeVisible();
    await genres.getByLabel("ジャンルの表示名を追加").fill(label);
    await genres.getByRole("button", { name: "追加" }).click();
    const row = genres.getByTestId("category-row").filter({ has: page.getByLabel(`${label}の表示名`) });
    await expect(row).toHaveCount(1);
    // 同じ表示名は追加できない
    await genres.getByLabel("ジャンルの表示名を追加").fill(label);
    await genres.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("同じ表示名の区分がすでにあります")).toBeVisible();
    await expect(row).toHaveCount(1);
    // 「不明」は隠せない
    const unknown = genres.getByTestId("category-row").filter({ has: page.getByLabel("不明の表示名") });
    await expect(unknown).toContainText("隠せません");

    // 新規登録のチップに出る
    await openNewForm(page, `e2e_${randomUUID().replaceAll("-", "")}`, shopName);
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("button", { name: "気になるで登録" }).click();
    // createTestUser は既定リストを作らないので、リスト追加の失敗通知（list_failed）付きでも店は登録されている。
    await expect(page).toHaveURL(/\/shops\/[0-9a-f-]{36}(\?notice=list_failed)?$/);
    const shopUrl = page.url().split("?")[0];
    await expect(page.getByText(label).first()).toBeVisible();

    // 改名しても、店の表示は新しい表示名になる
    await page.goto("/admin/categories");
    const renamed = `${label}改`;
    await row.getByLabel(`${label}の表示名`).fill(renamed);
    await row.getByRole("button", { name: "保存" }).click();
    await expect(page.getByLabel(`${renamed}の表示名`)).toBeVisible();
    await expect(page.getByLabel(`${renamed}の表示名`)).toHaveValue(renamed);
    const row2 = genres.getByTestId("category-row").filter({ has: page.getByLabel(`${renamed}の表示名`) });
    await expect(row2).toContainText("1店");

    // 非表示にすると /new から消える。店の表示は変わらない
    await row2.getByRole("button", { name: "非表示にする" }).click();
    await expect(row2).toContainText("非表示");
    await openNewForm(page, `e2e_${randomUUID().replaceAll("-", "")}`, `${shopName}B`);
    await expect(page.getByRole("button", { name: "和食", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: renamed, exact: true })).toHaveCount(0);

    await page.goto(shopUrl);
    await expect(page.getByText(renamed).first()).toBeVisible();

    // 編集画面では、今の値が非表示でもチップに残る
    await page.goto(`${shopUrl}/edit`);
    await expect(page.getByRole("button", { name: renamed, exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("↑↓で並び順を入れ替えられる", async ({ page }) => {
    const adminId = uniqueId("adm");
    await createTestUser(adminId, { admin: true });
    const a = `並びA${randomUUID().slice(0, 6)}`;
    const b = `並びB${randomUUID().slice(0, 6)}`;

    await loginAs(page, adminId);
    await page.goto("/admin/categories");
    const styles = page.getByTestId("category-section-style");
    for (const label of [a, b]) {
      await styles.getByLabel("形態の表示名を追加").fill(label);
      await styles.getByRole("button", { name: "追加" }).click();
      await expect(page.getByLabel(`${label}の表示名`)).toBeVisible();
    }
    const order = async () =>
      (await styles.getByTestId("category-row").getByRole("textbox").evaluateAll((els) =>
        els.map((e) => (e as HTMLInputElement).value),
      )).filter((v) => v === a || v === b);
    expect(await order()).toEqual([a, b]);

    await page.getByRole("button", { name: `${b}を上へ` }).click();
    await expect.poll(order).toEqual([b, a]);
  });
});
