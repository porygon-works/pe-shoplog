import { expect, test as setup } from "@playwright/test";
import { PASSPHRASE, PASSWORD, prepareSignup, uniqueLoginId } from "./support";

const authFile = "playwright/.auth/user.json";

setup("新規登録してログイン状態を保存する", async ({ page }) => {
  await prepareSignup();
  await page.goto("/signup");
  await page.getByLabel("ユーザーID").fill(uniqueLoginId("setup"));
  await page.getByLabel("ニックネーム").fill("セットアップ");
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByLabel("合言葉").fill(PASSPHRASE);
  await page.getByRole("button", { name: "登録してはじめる" }).click();
  await expect(page).toHaveURL(/\/map$/);
  await page.context().storageState({ path: authFile });
});
