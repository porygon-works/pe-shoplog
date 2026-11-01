import { expect, test } from "@playwright/test";

const bg = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("画面の明るさをダークに固定すると再読み込み後も保たれ、「端末に合わせる」で戻る", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/me?tab=account");
  const group = page.getByRole("group", { name: "画面の明るさ" });
  await expect(group.getByRole("button", { name: "端末に合わせる" })).toHaveAttribute("aria-pressed", "true");
  const light = await bg(page);

  await group.getByRole("button", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bg(page)).not.toBe(light);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(group.getByRole("button", { name: "ダーク" })).toHaveAttribute("aria-pressed", "true");

  await group.getByRole("button", { name: "端末に合わせる" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(await bg(page)).toBe(light);
});

test("端末がダークでも「ライト」に固定できる", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/me?tab=account");
  const dark = await bg(page);
  await page.getByRole("group", { name: "画面の明るさ" }).getByRole("button", { name: "ライト" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bg(page)).not.toBe(dark);
});

test("スマホでは入力欄の文字が 16px（iPhone の自動ズームを防ぐ）", async ({ page }) => {
  await page.goto("/new");
  const size = await page.getByLabel("店名でさがす").evaluate((el) => getComputedStyle(el).fontSize);
  expect(size).toBe("16px");
});
