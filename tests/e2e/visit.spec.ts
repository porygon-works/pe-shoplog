import { expect, test } from "@playwright/test";
import path from "node:path";
import { createShop, createTestUser, createVisit, uniqueId } from "../db/helpers";

const FIXTURE = path.join(__dirname, "fixtures", "sample.jpg");

test("何も選ばずに記録を保存すると、詳細ページの喫煙は不明のまま", async ({ page }) => {
  const shopId = await createShop(null, { name: "記録テスト酒場A" });
  await page.goto(`/shops/${shopId}/visits/new`);
  await expect(page.getByText("選ばなかった項目は「不明」として保存されます。")).toBeVisible();
  await page.getByRole("button", { name: "記録を保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`));
  await expect(page.getByText("喫煙 不明")).toBeVisible();
  await expect(page.getByText("1件")).toBeVisible();
});

test("★を付けて保存すると詳細に平均★が出る。同じ★の再タップで解除できる", async ({ page }) => {
  const shopId = await createShop(null, { name: "記録テスト酒場★" });
  await page.goto(`/shops/${shopId}/visits/new`);
  await page.getByRole("button", { name: "★4", exact: true }).click();
  await expect(page.getByRole("button", { name: "★4", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "★4", exact: true }).click();
  await expect(page.getByRole("button", { name: "★4", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "★4", exact: true }).click();
  await page.getByRole("button", { name: "記録を保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`));
  await expect(page.getByTestId("shop-rating")).toHaveText("★4.0（1件）");
  await expect(page.getByRole("img", { name: "評価 ★4" })).toBeVisible();
});

test("行った日を空にして保存でき、詳細には「日付なし」と出る。/new に参考リンク欄はない", async ({ page }) => {
  const shopId = await createShop(null, { name: "記録テスト酒場日付なし" });
  await page.goto(`/shops/${shopId}/visits/new`);
  await page.getByRole("button", { name: "日付なしにする" }).click();
  await expect(page.getByLabel("行った日")).toHaveValue("");
  await page.getByRole("button", { name: "記録を保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`));
  await expect(page.getByText("日付なし", { exact: true })).toBeVisible();
  await expect(page.getByTestId("shop-rating")).toHaveCount(0);

  await page.goto("/new");
  await expect(page.getByLabel("店名でさがす")).toBeVisible();
  await expect(page.getByLabel("予約・参考リンク")).toHaveCount(0);
});

test("禁煙・打ち上げ・写真つきで保存すると詳細ページに反映され、本人は編集・削除できる", async ({ page }) => {
  const shopId = await createShop(null, { name: "記録テスト酒場B" });
  await page.goto(`/shops/${shopId}/visits/new`);
  await page.getByRole("button", { name: "禁煙", exact: true }).click();
  await page.getByRole("button", { name: "打ち上げ", exact: true }).click();
  await page.getByLabel("コメント").fill("写真つきのコメント");
  await page.getByLabel("写真を追加").setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "記録を保存" }).click();

  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`), { timeout: 20_000 });
  await expect(page.getByTestId("stat-smoking")).toContainText("禁煙");
  await expect(page.getByText("写真つきのコメント")).toBeVisible();
  const img = page.getByRole("img", { name: "その他の写真" }).first();
  await expect(img).toBeVisible();
  await expect
    .poll(async () => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);

  await expect(page.getByRole("link", { name: "編集", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "削除" })).toBeVisible();

  // 編集: コメントを変えて、写真は残る
  await page.getByRole("link", { name: "編集", exact: true }).first().click();
  await expect(page).toHaveURL(/\/visits\/[0-9a-f-]+\/edit$/);
  await expect(page.getByLabel("コメント")).toHaveValue("写真つきのコメント");
  await expect(page.getByTestId("photo-tile")).toHaveCount(1);
  await page.getByLabel("コメント").fill("直したコメント");
  await page.getByRole("button", { name: "記録を保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`));
  await expect(page.getByText("直したコメント")).toBeVisible();

  // 削除
  await page.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText("直したコメント")).toHaveCount(0);
  await expect(page.getByText("0件")).toBeVisible();
});

test("他人の記録には編集・削除が出ず、編集ページは 404", async ({ page }) => {
  const other = await createTestUser(uniqueId("e2e"));
  const shopId = await createShop(other.id, { name: "記録テスト酒場C" });
  const visitId = await createVisit(shopId, other.id, { comment: "他人のコメント" });
  await page.goto(`/shops/${shopId}`);
  await expect(page.getByText("他人のコメント")).toBeVisible();
  await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
  await page.goto(`/visits/${visitId}/edit`);
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});

test("詳細 → 記録を付けて保存 → 詳細に戻り、「戻る」で入力画面に戻らない（行き来のループにならない）", async ({ page }) => {
  const shopId = await createShop(null, { name: "戻るテスト酒場" });
  await page.goto("/search");
  await page.goto(`/shops/${shopId}`);
  await page.getByRole("link", { name: "行った記録を付ける" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}/visits/new$`));
  await page.getByRole("button", { name: "記録を保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`));
  await expect(page.getByText("1件")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/search/);
});
