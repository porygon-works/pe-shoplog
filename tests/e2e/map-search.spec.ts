import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

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

test("地図で店を検索 → カードの「行った」で登録 → 記録の入力へ進む", async ({ page }) => {
  const placeId = `e2e_${randomUUID().replaceAll("-", "")}`;
  const name = `池袋の行ったテスト食堂 ${placeId.slice(-6)}`;
  await mockPlace(page, placeId, name);

  await page.goto("/map");
  await page.getByRole("searchbox", { name: "お店をさがす" }).fill("池袋 食堂");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByTestId("place-sheet").getByRole("button", { name: "行った（記録する）" }).click();

  await expect(page).toHaveURL(/\/shops\/[0-9a-f-]{36}\/visits\/new$/);
});
