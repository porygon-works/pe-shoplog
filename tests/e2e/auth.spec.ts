import { expect, test } from "@playwright/test";
import { PASSPHRASE, PASSWORD, prepareSignup, uniqueLoginId } from "./support";

// 認証フローそのものを検証するので、保存済みのログイン状態は使わない。
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeAll(prepareSignup);

async function fillSignup(
  page: import("@playwright/test").Page,
  loginId: string,
  passphrase: string,
) {
  await page.goto("/signup");
  await page.getByLabel("ユーザーID").fill(loginId);
  await page.getByLabel("ニックネーム").fill("テスト花子");
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByLabel("合言葉").fill(passphrase);
  await page.getByRole("button", { name: "登録してはじめる" }).click();
}

test("新規登録 → /map → ログアウト → ログイン → /map", async ({ page }) => {
  const loginId = uniqueLoginId();
  await fillSignup(page, loginId, ` ${PASSPHRASE.toUpperCase()} `);
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByTestId("current-nickname")).toContainText("テスト花子");

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/map");
  await expect(page).toHaveURL(/\/login\?next=%2Fmap$/);

  await page.getByLabel("ユーザーID").fill(loginId.toUpperCase());
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
});

test("合言葉を間違えると「合言葉が違います」と表示される", async ({ page }) => {
  await fillSignup(page, uniqueLoginId(), "xx");
  await expect(page.locator("form [role=alert]")).toHaveText("合言葉が違います");
  await expect(page).toHaveURL(/\/signup$/);
});

test("パスワードが違うと「IDかパスワードが違います」と表示される", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill("nobody_here");
  await page.getByLabel("パスワード").fill("wrong-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("IDかパスワードが違います");
});

test("入力が不正ならフィールドごとに日本語で表示される", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("ユーザーID").fill("ab");
  await page.getByLabel("ニックネーム").fill("あ");
  await page.getByLabel("パスワード").fill("short");
  await page.getByLabel("合言葉").fill("pe");
  await page.getByRole("button", { name: "登録してはじめる" }).click();
  await expect(
    page.getByText("ユーザーIDは半角英小文字・数字・記号（. _ -）で3〜20文字です（最初と最後は英数字）"),
  ).toBeVisible();
  await expect(page.getByText("パスワードは8文字以上です")).toBeVisible();
});
