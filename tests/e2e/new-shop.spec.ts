import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

test("渋谷で検索 → 候補を選ぶ → 店名を編集 → 気になるで登録 → 詳細ページに店名が出る", async ({ page }) => {
  const placeId = `e2e_${randomUUID().replaceAll("-", "")}`;
  const sessions = new Set<string>();

  await page.route("**/api/places/autocomplete**", (route) => {
    const url = new URL(route.request().url());
    sessions.add(url.searchParams.get("session") ?? "");
    return route.fulfill(
      json({ suggestions: [{ placeId, mainText: "渋谷のテスト酒場", secondaryText: "東京都渋谷区" }] }),
    );
  });
  await page.route("**/api/places/details**", (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("id")).toBe(placeId);
    expect(sessions.has(url.searchParams.get("session") ?? "x")).toBe(true);
    return route.fulfill(json({ placeId, name: "渋谷のテスト酒場", lat: 35.659, lng: 139.7 }));
  });

  await page.goto("/new");
  await page.getByLabel("店名でさがす").fill("渋谷");
  await page.getByRole("button", { name: /渋谷のテスト酒場/ }).click();

  const name = page.getByLabel("店名（必須）");
  await expect(name).toHaveValue("渋谷のテスト酒場");
  await name.fill("渋谷のテスト酒場 本店");
  await page.getByRole("button", { name: "居酒屋", exact: true }).click();
  await page.getByRole("button", { name: "気になるで登録" }).click();

  await expect(page).toHaveURL(/\/shops\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("shop-name")).toHaveText("渋谷のテスト酒場 本店");
});

test("同じ店をもう一度登録すると「すでに登録されています」と出て既存の詳細へ移動する", async ({ page }) => {
  const placeId = `e2e_${randomUUID().replaceAll("-", "")}`;
  await page.route("**/api/places/autocomplete**", (route) =>
    route.fulfill(json({ suggestions: [{ placeId, mainText: "重複テスト店", secondaryText: "東京都" }] })),
  );
  await page.route("**/api/places/details**", (route) =>
    route.fulfill(json({ placeId, name: "重複テスト店", lat: 35.6, lng: 139.7 })),
  );

  const register = async () => {
    await page.goto("/new");
    await page.getByLabel("店名でさがす").fill("重複");
    await page.getByRole("button", { name: /重複テスト店/ }).click();
    await page.getByRole("button", { name: "気になるで登録" }).click();
    await expect(page).toHaveURL(/\/shops\/[0-9a-f-]{36}/);
  };
  await register();
  const first = page.url();
  await register();
  expect(page.url().split("?")[0]).toBe(first.split("?")[0]);
  await expect(page.getByText("すでに登録されています")).toBeVisible();
});

test("検索 API が失敗したらトーストで知らせる", async ({ page }) => {
  await page.route("**/api/places/autocomplete**", (route) =>
    route.fulfill(json({ error: "places_unavailable" }, 502)),
  );
  await page.goto("/new");
  await page.getByLabel("店名でさがす").fill("渋谷");
  await expect(
    page.getByText("お店の検索に失敗しました。時間をおいてもう一度お試しください"),
  ).toBeVisible();
});

test("手入力は地図が読み込めないとエラーが出て登録ボタンが無効になる", async ({ page }) => {
  test.skip(!!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, "地図キーがある環境ではスキップ");
  await page.goto("/new");
  await page.getByRole("button", { name: /候補にない店を手入力する/ }).click();
  await expect(page.getByText("地図を読み込めませんでした")).toBeVisible();
  await page.getByLabel("店名（必須）").fill("手入力の店");
  await expect(page.getByRole("button", { name: "気になるで登録" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "行った記録を付ける" })).toBeDisabled();
});
