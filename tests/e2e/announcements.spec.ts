import { expect, test, type Browser } from "@playwright/test";
import { createTestUser, TEST_PASSWORD, uniqueId } from "../db/helpers";

async function asUser(browser: Browser, loginId: string) {
  const context = await browser.newContext({ baseURL: "http://localhost:3000", serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(loginId);
  await page.getByLabel("パスワード").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/map$/);
  return { context, page };
}

test.setTimeout(60_000);

test("お知らせ: 「自分だけ」で出すと自分にだけ件数バッジ → 「全員に出す」でメンバーにも付き、お知らせ画面を開くと消える。編集・削除もできる", async ({
  browser,
}) => {
  const adminId = uniqueId("na");
  const memberId = uniqueId("nm");
  await createTestUser(adminId, { admin: true });
  await createTestUser(memberId);
  const title = `新機能のお知らせ${uniqueId("").slice(-5)}`;

  const A = await asUser(browser, adminId);
  const M = await asUser(browser, memberId);
  // それぞれ一度お知らせ画面を開き、ほかのテストのお知らせを既読にしておく
  await A.page.goto("/announcements");
  await M.page.goto("/announcements");

  // 自分だけに出す
  await A.page.goto("/admin");
  await A.page.getByRole("link", { name: "お知らせ" }).click();
  await expect(A.page).toHaveURL(/\/admin\/announcements$/);
  await A.page.getByLabel("タイトル").fill(title);
  await A.page.getByLabel(/本文/).fill("お知らせ機能を追加しました。\n詳しくは https://example.com/notes");
  await A.page.getByLabel("自分だけ（見え方の確認用）").check();
  await A.page.getByRole("button", { name: "お知らせを出す" }).click();
  const item = A.page.getByTestId("announcement-admin-item").filter({ hasText: title });
  await expect(item.getByTestId("announcement-audience")).toHaveText("自分だけ");

  // 自分（管理者）にはマイページのタブと鈴に「1」
  await A.page.goto("/me");
  await expect(A.page.getByTestId("nav-unread")).toHaveText("1");
  await expect(A.page.getByTestId("announcement-unread")).toHaveText("1");
  // メンバーには出ない
  await M.page.goto("/me");
  await expect(M.page.getByTestId("nav-unread")).toHaveCount(0);
  await M.page.goto("/announcements");
  await expect(M.page.getByText(title)).toHaveCount(0);

  // 全員に出す → メンバーにも件数が付く
  await A.page.goto("/admin/announcements");
  await item.getByRole("button", { name: "全員に出す" }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(item.getByTestId("announcement-audience")).toHaveCount(0);
  await M.page.goto("/me");
  await expect(M.page.getByTestId("nav-unread")).toHaveText("1");
  await M.page.getByRole("link", { name: "お知らせ（未読 1 件）" }).click();
  await expect(M.page).toHaveURL(/\/announcements$/);
  const list = M.page.getByTestId("announcements");
  await expect(list).toContainText(title);
  await expect(
    list.getByRole("listitem").filter({ hasText: title }).getByRole("link", { name: "https://example.com/notes" }),
  ).toHaveAttribute("target", "_blank");
  // お知らせ画面を開いたので、下のメニューのバッジも消える
  await expect(M.page.getByTestId("nav-unread")).toHaveCount(0);
  await M.page.goto("/me");
  await expect(M.page.getByTestId("announcement-unread")).toHaveCount(0);
  await expect(M.page.getByRole("link", { name: "お知らせ", exact: true })).toBeVisible();

  // 管理者が編集すると内容が変わる（未読には戻らない）
  await item.getByRole("button", { name: "編集" }).click();
  const editing = A.page.getByTestId("announcement-admin-item").filter({ has: A.page.getByRole("button", { name: "保存" }) });
  await editing.getByLabel("タイトル").fill(`${title}（改）`);
  await editing.getByRole("button", { name: "保存" }).click();
  await expect(A.page.getByTestId("announcement-admin-item").filter({ hasText: `${title}（改）` })).toBeVisible();
  await M.page.goto("/announcements");
  await expect(M.page.getByTestId("announcements")).toContainText(`${title}（改）`);

  // 削除すると一覧から消える
  await A.page.getByTestId("announcement-admin-item").filter({ hasText: `${title}（改）` }).getByRole("button", { name: "削除" }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page.getByTestId("announcement-admin-item").filter({ hasText: `${title}（改）` })).toHaveCount(0);
  await M.page.goto("/announcements");
  await expect(M.page.getByText(`${title}（改）`)).toHaveCount(0);

  await A.context.close();
  await M.context.close();
});

test("お知らせの管理画面は管理者以外は 404", async ({ page }) => {
  await page.goto("/admin/announcements");
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});
