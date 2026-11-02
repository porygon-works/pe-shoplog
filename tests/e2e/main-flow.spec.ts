import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createShop } from "../db/helpers";
import { PASSPHRASE, PASSWORD, prepareSignup, uniqueLoginId } from "./support";

const PHOTO = path.join(__dirname, "fixtures", "sample.jpg");
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

// 新規登録から始めるので、共通のログイン状態は使わない。
test.use({ storageState: { cookies: [], origins: [] } });

async function signUp(browser: Browser, nickname: string) {
  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  const loginId = uniqueLoginId("flow");
  await page.goto("/signup");
  await page.getByLabel("ユーザーID").fill(loginId);
  await page.getByLabel("ニックネーム").fill(nickname);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByLabel("合言葉").fill(PASSPHRASE);
  await page.getByRole("button", { name: "登録してはじめる" }).click();
  await expect(page).toHaveURL(/\/map$/);
  return { context, page, loginId };
}

async function mockPlaces(page: Page, placeId: string, name: string) {
  await page.route("**/api/places/autocomplete**", (route) =>
    route.fulfill(json({ suggestions: [{ placeId, mainText: name, secondaryText: "東京都渋谷区" }] })),
  );
  await page.route("**/api/places/details**", (route) =>
    route.fulfill(json({ placeId, name, lat: 35.659, lng: 139.7 })),
  );
}

test("主要フロー(1): 気になる登録 → 別ユーザーが記録 → 訪問ありに変わる → 公開リストを別ユーザーが見つける", async ({ browser }) => {
  await prepareSignup();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const shopName = `通しテスト酒場${suffix}`;
  const publicList = `公開${suffix}`;

  const A = await signUp(browser, "ユーザーA");
  const B = await signUp(browser, "ユーザーB");

  // A: 店を「気になる」で登録
  await mockPlaces(A.page, `e2e_${randomUUID().replaceAll("-", "")}`, shopName);
  await A.page.goto("/new");
  await A.page.getByLabel("店名でさがす").fill("通しテスト");
  await A.page.getByRole("button", { name: new RegExp(shopName) }).click();
  await A.page.getByRole("button", { name: "気になるで登録" }).click();
  await expect(A.page).toHaveURL(/\/shops\/[0-9a-f-]{36}$/);
  const shopUrl = new URL(A.page.url()).pathname;
  const shopId = shopUrl.split("/").pop()!;
  await expect(A.page.getByTestId("shop-name")).toHaveText(shopName);
  await expect(A.page.getByText("気になる（未訪問）")).toBeVisible();
  await A.page.goto(`/search?q=${suffix}`);
  await expect(A.page.getByTestId("shop-card")).toContainText("気になる（未訪問）");

  // B: 同じ店に写真つきで記録を付ける
  await B.page.goto(`/shops/${shopId}/visits/new`);
  await B.page.getByLabel("コメント").fill("通しテストのコメント");
  await B.page.getByLabel("写真を追加").setInputFiles(PHOTO);
  await B.page.getByRole("button", { name: "記録を保存" }).click();
  await expect(B.page).toHaveURL(new RegExp(`/shops/${shopId}$`), { timeout: 20_000 });
  await expect(B.page.getByText("通しテストのコメント")).toBeVisible();

  // A: 店は「訪問あり」に変わっている
  await A.page.goto(`/search?q=${suffix}`);
  await expect(A.page.getByTestId("shop-card")).toHaveCount(1);
  await expect(A.page.getByTestId("shop-card")).not.toContainText("気になる（未訪問）");
  await A.page.goto(shopUrl);
  await expect(A.page.getByText("気になる（未訪問）")).toHaveCount(0);
  await expect(A.page.getByText("通しテストのコメント")).toBeVisible();

  // A: 新しい公開リストに追加する
  await A.page.getByRole("button", { name: /お気に入り/ }).click();
  const favSheet = A.page.getByRole("dialog", { name: "「お気に入り」のリストに追加" });
  await favSheet.getByRole("button", { name: "＋ 新しいリストを作る" }).click();
  await favSheet.getByLabel("リスト名").fill(publicList);
  await favSheet.getByRole("checkbox", { name: "共有する（ログインしている人が見られます）" }).check();
  await favSheet.getByRole("button", { name: "作る" }).click();
  await expect(favSheet.getByRole("checkbox", { name: new RegExp(publicList) })).toBeChecked();
  await favSheet.getByRole("button", { name: "完了" }).click();

  // B: 検索の「リスト」タブで見つけて開く
  await B.page.goto("/search?tab=lists");
  await B.page.getByLabel("リスト名でさがす").fill(publicList);
  await expect(B.page).toHaveURL(/lq=/);
  const link = B.page.getByRole("link", { name: new RegExp(publicList) });
  await expect(link).toBeVisible();
  await link.click();
  await expect(B.page).toHaveURL(/\/lists\/[0-9a-f-]+$/);
  await expect(B.page.getByTestId("shop-card")).toContainText(shopName);

  await A.context.close();
  await B.context.close();
});

test("主要フロー(2): 共有リストを作って招待リンクで参加し、店を入れると両方に見える", async ({ browser }) => {
  await prepareSignup();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const shopName = `共有通し酒場${suffix}`;
  const sharedList = `共有${suffix}`;
  const A = await signUp(browser, "ユーザーA");
  const B = await signUp(browser, "ユーザーB");
  const shopId = await createShop(null, { name: shopName });
  const shopUrl = `/shops/${shopId}`;

  // A: 共有リストを作り、招待リンクを B に渡す
  await A.page.goto("/me");
  await A.page.getByRole("tab", { name: "共有リスト" }).click();
  await A.page.getByRole("button", { name: "＋ メンバーで編集するリストを作る" }).click();
  await A.page.getByLabel("リスト名").fill(sharedList);
  await A.page.getByRole("button", { name: "作る" }).click();
  await expect(A.page).toHaveURL(/\/shared\/[0-9a-f-]+$/);
  const sharedUrl = new URL(A.page.url()).pathname;
  const inviteUrl = await A.page.getByLabel("招待リンク").inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[0-9a-f]{32}$/);

  await B.page.goto(inviteUrl);
  await expect(B.page.getByText(sharedList)).toBeVisible();
  await B.page.getByRole("button", { name: "参加する" }).click();
  await expect(B.page).toHaveURL(new RegExp(`${sharedUrl}$`));

  // A が店を共有リストに入れると、A と B の両方に見える
  await A.page.goto(shopUrl);
  await A.page.getByRole("button", { name: "＋ リスト" }).click();
  const sheet = A.page.getByRole("dialog", { name: "リストに追加" });
  await sheet.getByRole("checkbox", { name: new RegExp(sharedList) }).check();
  await expect(sheet.getByRole("checkbox", { name: new RegExp(sharedList) })).toBeChecked();
  await sheet.getByRole("button", { name: "完了" }).click();
  for (const { page } of [A, B]) {
    await expect
      .poll(async () => {
        await page.goto(sharedUrl);
        return page.getByTestId("shop-card").filter({ hasText: shopName }).count();
      })
      .toBe(1);
  }

  await A.context.close();
  await B.context.close();
});
