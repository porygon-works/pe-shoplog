import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { adminClient } from "../db/helpers";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockPlace(page: Page, placeId: string, name: string) {
  await page.route("**/api/places/autocomplete**", (route) => {
    const url = new URL(route.request().url());
    // 地図の中心（初期は池袋駅）の近くを優先して探す。
    expect(Number(url.searchParams.get("lat"))).toBeCloseTo(35.7295, 3);
    expect(Number(url.searchParams.get("lng"))).toBeCloseTo(139.7109, 3);
    return route.fulfill(json({ suggestions: [{ placeId, mainText: name, secondaryText: "東京都豊島区" }] }));
  });
  await page.route("**/api/places/details**", (route) =>
    route.fulfill(json({ placeId, name, lat: 35.7301, lng: 139.7115 })),
  );
}

test("地図で店を検索 → カードの「気になる」で登録 → 詳細ページへ。もう一度検索すると登録済みのカードが出る", async ({
  page,
}) => {
  const placeId = `e2e_${randomUUID().replaceAll("-", "")}`;
  const name = `池袋の地図テスト酒場 ${placeId.slice(-6)}`;
  await mockPlace(page, placeId, name);

  await page.goto("/map");
  await page.getByRole("searchbox", { name: "お店をさがす" }).fill("池袋 酒場");
  await page.getByRole("button", { name: new RegExp(name) }).click();

  const sheet = page.getByTestId("place-sheet");
  await expect(sheet.getByTestId("place-name")).toHaveText(name);
  await expect(page.getByRole("searchbox", { name: "お店をさがす" })).toHaveValue("");
  await sheet.getByRole("button", { name: "気になる", exact: true }).click();

  await expect(page).toHaveURL(/\/shops\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("shop-name")).toHaveText(name);
  await expect(page.getByText("気になる（未訪問）")).toBeVisible();

  await page.goto("/map");
  await page.getByRole("searchbox", { name: "お店をさがす" }).fill("池袋 酒場");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("shop-sheet")).toContainText(name);
  await expect(page.getByTestId("place-sheet")).toHaveCount(0);
});

test("地図で店を検索 → カードの「行った」→ ジャンルなどを入れて登録すると、その時点で記録が 1 件でき、入力画面を閉じても「気になる」にならない。操作ログにも残る", async ({ page }) => {
  const placeId = `e2e_${randomUUID().replaceAll("-", "")}`;
  const name = `池袋の行ったテスト食堂 ${placeId.slice(-6)}`;
  await mockPlace(page, placeId, name);

  await page.goto("/map");
  await page.getByRole("searchbox", { name: "お店をさがす" }).fill("池袋 食堂");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByTestId("place-sheet").getByRole("link", { name: "行った（記録する）" }).click();

  // まず店の情報（ジャンルなど）を入れる画面。地図で取った名前が入っている
  await expect(page).toHaveURL(/\/new\?.*mode=visit/);
  await expect(page.getByRole("heading", { name: "行ったお店を登録" })).toBeVisible();
  await expect(page.getByLabel("店名（必須）")).toHaveValue(name);
  await expect(page.getByRole("button", { name: "気になるで登録" })).toHaveCount(0);
  await page.getByRole("button", { name: "ラーメン", exact: true }).click();
  await page.getByRole("button", { name: "登録して行った記録を付ける" }).click();

  await expect(page).toHaveURL(/\/visits\/[0-9a-f-]{36}\/edit\?new=1$/);
  await expect(page.getByTestId("visit-created-notice")).toBeVisible();

  // 何も書かずに「← 戻る」で離れても、行った記録は残っている
  await page.getByRole("link", { name: "← 戻る" }).click();
  await expect(page).toHaveURL(/\/shops\/[0-9a-f-]{36}$/);
  const shopId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByText("気になる（未訪問）")).toHaveCount(0);
  await expect(page.getByText("1件")).toBeVisible();
  await expect(page.getByTestId("shop-categories")).toContainText("ラーメン");

  // 操作ログ（店の登録と、作った記録の id）
  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from("app_logs")
        .select("action, level, detail")
        .eq("action", "shop_create")
        .filter("detail->>shopId", "eq", shopId);
      return data?.[0] ?? null;
    })
    .toMatchObject({ level: "info", detail: { mode: "visit", shopId } });
});
