import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { adminClient, createShop, createTestUser, createVisit, uniqueId } from "../db/helpers";

async function fixture(withPlace = true) {
  const loginId = uniqueId("e2e");
  const user = await createTestUser(loginId);
  const placeId = withPlace ? `e2e_${randomUUID().replaceAll("-", "")}` : null;
  const shopId = await createShop(user.id, {
    name: "詳細テスト酒場",
    genre: "yakitori",
    styles: ["izakaya"],
    place_id: placeId,
  });
  // 古い記録は喫煙可、新しい記録は禁煙 → 代表値は新しい方（禁煙）
  await createVisit(shopId, user.id, {
    visited_on: "2026-01-10",
    smoking: "smoking_ok",
    price_range: "3000_4999",
    purpose: "celebration",
    party_size: 6,
    comment: "古い記録のコメント",
  });
  await createVisit(shopId, user.id, {
    visited_on: "2026-02-20",
    smoking: "no_smoking",
    price_range: "3000_4999",
    purpose: "team_meeting",
    party_size: 12,
    comment: "新しい記録のコメント",
  });
  return { shopId, userId: user.id, loginId };
}

test("詳細ページに喫煙・値段感の代表値と内訳、行った記録が出る", async ({ page }) => {
  const { shopId } = await fixture();
  await page.goto(`/shops/${shopId}`);
  await expect(page.getByTestId("shop-name")).toHaveText("詳細テスト酒場");
  const smoking = page.getByTestId("stat-smoking");
  await expect(smoking).toContainText("禁煙");
  await expect(smoking).toContainText("喫煙可 1件");
  await expect(page.getByTestId("stat-price")).toContainText("3,000〜4,999");
  await expect(page.getByTestId("stat-max")).toContainText("12人");
  await expect(page.getByText("新しい記録のコメント")).toBeVisible();
  await expect(page.getByRole("link", { name: "行った記録を付ける" })).toHaveAttribute(
    "href",
    `/shops/${shopId}/visits/new`,
  );
  await expect(page.getByRole("link", { name: "Googleマップで開く" })).toHaveAttribute(
    "href",
    /google\.com\/maps\/search\/\?api=1&query=/,
  );
});

test("記録の投稿者名はユーザーページへのリンクになっている", async ({ page }) => {
  const { shopId, loginId } = await fixture();
  await page.goto(`/shops/${shopId}`);
  const link = page.getByRole("link", { name: loginId }).first();
  await expect(link).toHaveAttribute("href", `/users/${loginId}`);
});

test("「戻る」: 直接開いたら地図へ、アプリ内で移動してきたなら前の画面へ", async ({ page }) => {
  const { shopId, loginId } = await fixture();
  await page.goto(`/shops/${shopId}`);
  await page.getByRole("button", { name: "← 戻る" }).click();
  await expect(page).toHaveURL(/\/map$/);

  // 他のユーザーのページからリンクで移動してきた（アプリ内の移動）
  await page.goto(`/users/${loginId}`);
  await page.getByRole("link", { name: /詳細テスト酒場/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`));
  await page.getByRole("button", { name: "← 戻る" }).click();
  await expect(page).toHaveURL(new RegExp(`/users/${loginId}$`));
});

test("公式サイトは新しいタブで開くリンクになっている", async ({ page }) => {
  const { shopId } = await fixture();
  await page.goto(`/shops/${shopId}`);
  const link = page.getByRole("link", { name: /公式サイト/ });
  await expect(link).toHaveAttribute("href", `/shops/${shopId}/website`);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("サイト情報の取得に失敗したページはエラーメッセージを出す", async ({ page }) => {
  // e2e では GOOGLE_PLACES_API_KEY がなく getPlaceWebsite が PlacesError になる。
  test.skip(!!process.env.GOOGLE_PLACES_API_KEY, "Places キーがある環境ではスキップ");
  const { shopId } = await fixture();
  await page.goto(`/shops/${shopId}/website`);
  await expect(
    page.getByText("サイト情報を取得できませんでした。時間をおいてもう一度お試しください"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "店の詳細に戻る" })).toBeVisible();
});

test("place_id のない店のサイト用ページは見つからない表示", async ({ page }) => {
  const { shopId } = await fixture(false);
  await page.goto(`/shops/${shopId}/website`);
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});

test("place_id のない店では公式サイトのボタンを出さない", async ({ page }) => {
  const { shopId } = await fixture(false);
  await page.goto(`/shops/${shopId}`);
  await expect(page.getByTestId("shop-name")).toBeVisible();
  await expect(page.getByRole("link", { name: /公式サイト/ })).toHaveCount(0);
});

test("まだ誰も行っていない店は案内を出し、集計は出さない", async ({ page }) => {
  const user = await createTestUser(uniqueId("e2e"));
  const shopId = await createShop(user.id, { name: "未訪問の店" });
  await page.goto(`/shops/${shopId}`);
  await expect(
    page.getByText("まだ誰も行っていない「気になる」店です。行ったら記録を付けてみんなに教えてください。"),
  ).toBeVisible();
  await expect(page.getByTestId("stat-smoking")).toHaveCount(0);
});

test("退会したユーザーの記録は「退会したユーザー」と表示され、削除済みの記録は出ない", async ({ page }) => {
  const { shopId, userId } = await fixture();
  const gone = await createVisit(shopId, userId, {
    visited_on: "2026-03-01",
    comment: "削除済みのコメント",
    deleted_at: new Date().toISOString(),
  });
  expect(gone).toBeTruthy();
  const orphan = await createVisit(shopId, userId, { visited_on: "2026-03-02", comment: "退会者のコメント" });
  const up = await adminClient().from("visits").update({ user_id: null }).eq("id", orphan);
  expect(up.error).toBeNull();
  await page.goto(`/shops/${shopId}`);
  await expect(page.getByText("退会者のコメント")).toBeVisible();
  await expect(page.getByText("退会したユーザー")).toBeVisible();
  await expect(page.getByText("削除済みのコメント")).toHaveCount(0);
});

test("店情報を編集すると詳細ページに反映される", async ({ page }) => {
  const { shopId } = await fixture();
  await page.goto(`/shops/${shopId}`);
  await page.getByRole("link", { name: "編集" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}/edit$`));
  await page.getByLabel("店名（必須）").fill("名前を変えた酒場");
  await page.getByRole("button", { name: "ラーメン", exact: true }).click();
  await page.getByLabel("予約・参考リンク").fill("https://example.com/reserve");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/shops/${shopId}$`));
  await expect(page.getByTestId("shop-name")).toHaveText("名前を変えた酒場");
  await expect(page.getByRole("link", { name: "https://example.com/reserve" })).toBeVisible();
});

test("存在しない店の ID は 404", async ({ page }) => {
  await page.goto(`/shops/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});

test("写真は署名付き URL で表示され、種類で切り替えられる。削除済みの記録の写真は出ない", async ({ page }) => {
  const { shopId, userId } = await fixture();
  const admin = adminClient();
  // 1x1 の JPEG
  const jpg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDnqKKK8k/Qz//Z",
    "base64",
  );
  const live = await createVisit(shopId, userId, { visited_on: "2026-04-01" });
  const dead = await createVisit(shopId, userId, { visited_on: "2026-04-02", deleted_at: new Date().toISOString() });
  for (const [visit, kind] of [[live, "food"], [live, "seat"], [dead, "menu"]] as const) {
    const path = `shops/${shopId}/visits/${visit}/${randomUUID()}.jpg`;
    const up = await admin.storage.from("photos").upload(path, jpg, { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    const ins = await admin
      .from("photos")
      .insert({ visit_id: visit, shop_id: shopId, user_id: userId, kind, storage_path: path });
    expect(ins.error).toBeNull();
  }
  await page.goto(`/shops/${shopId}`);
  await expect(page.getByText("2枚")).toBeVisible();
  const gallery = page.getByRole("group", { name: "写真の種類" }).locator("xpath=..");
  await expect(gallery.getByRole("img")).toHaveCount(2);
  await gallery.getByRole("button", { name: "席", exact: true }).click();
  await expect(gallery.getByRole("img")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "メニュー", exact: true })).toHaveCount(0);
});

test("UUID でない店 ID は 500 ではなく 404", async ({ page }) => {
  await page.goto(`/shops/${"a".repeat(8)}-aaaa-aaaa-aaaa-${"-".repeat(0)}zzzzzzzzzzzz`);
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});

test("ユーザーの写真がない place_id 付きの店では Google の写真と投稿者表記が出る", async ({ page }) => {
  const { shopId } = await fixture();
  await page.route("**/api/places/photo*", (route) =>
    route.fulfill({
      json: {
        photo: {
          // 外部へ出ないよう data URL の 1x1 GIF
          url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
          authors: [{ name: "写真の投稿者", uri: "https://maps.google.com/contrib/1" }],
        },
      },
    }),
  );
  await page.goto(`/shops/${shopId}`);
  const box = page.getByTestId("google-photo");
  await expect(box.getByRole("img", { name: "Google の写真" })).toBeVisible();
  await expect(box).toContainText("写真: Google");
  const link = box.getByRole("link", { name: "写真の投稿者" });
  await expect(link).toHaveAttribute("href", "https://maps.google.com/contrib/1");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("ユーザーの写真がある店、place_id のない店では Google の写真を取得も表示もしない", async ({ page }) => {
  let requested = 0;
  await page.route("**/api/places/photo*", (route) => {
    requested++;
    return route.fulfill({ json: { photo: null } });
  });
  const { shopId, userId } = await fixture();
  const visit = await createVisit(shopId, userId, { visited_on: "2026-04-01" });
  const path = `shops/${shopId}/visits/${visit}/${randomUUID()}.jpg`;
  const up = await adminClient().storage.from("photos").upload(path, Buffer.from("x"), { contentType: "image/jpeg" });
  expect(up.error).toBeNull();
  const ins = await adminClient()
    .from("photos")
    .insert({ visit_id: visit, shop_id: shopId, user_id: userId, kind: "food", storage_path: path });
  expect(ins.error).toBeNull();
  await page.goto(`/shops/${shopId}`);
  await expect(page.getByTestId("shop-name")).toBeVisible();
  const noPlace = await fixture(false);
  await page.goto(`/shops/${noPlace.shopId}`);
  await expect(page.getByTestId("shop-name")).toBeVisible();
  await page.waitForTimeout(500);
  expect(requested).toBe(0);
  await expect(page.getByTestId("google-photo")).toHaveCount(0);
});
