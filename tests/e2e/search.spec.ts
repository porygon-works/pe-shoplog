import { expect, test } from "@playwright/test";
import { adminClient, createShop, createTestUser, createVisit, uniqueId } from "../db/helpers";

async function fixture() {
  const user = await createTestUser(uniqueId("e2e"));
  const tag = uniqueId("srch");
  const smoke = await createShop(user.id, { name: `${tag}喫煙酒場`, genre: "yakitori" });
  await createVisit(smoke, user.id, { smoking: "separated", purpose: "celebration" });
  const clean = await createShop(user.id, { name: `${tag}禁煙食堂`, genre: "washoku" });
  await createVisit(clean, user.id, { smoking: "no_smoking" });
  await createShop(user.id, { name: `${tag}気になる店` });
  return { tag };
}

test("「吸える」で絞り込むと該当の店だけが残り、URL に残って再読み込みでも保たれる", async ({ page }) => {
  const { tag } = await fixture();
  await page.goto(`/search?q=${tag}`);
  const cards = page.getByTestId("shop-card");
  await expect(cards).toHaveCount(3);

  await page.getByRole("button", { name: "吸える", exact: true }).click();
  await expect(page).toHaveURL(/smoking=/);
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(`${tag}喫煙酒場`);
  await expect(page.getByTestId("result-count")).toHaveText("1件");

  await page.reload();
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("button", { name: "吸える", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "吸える", exact: true }).click();
  await expect(cards).toHaveCount(3);
});

test("絞り込みシートから適用できる", async ({ page }) => {
  const { tag } = await fixture();
  await page.goto(`/search?q=${tag}`);
  await page.getByRole("button", { name: /ジャンル/ }).click();
  const dialog = page.getByRole("dialog", { name: "絞り込み" });
  await dialog.getByRole("button", { name: "和食", exact: true }).click();
  await dialog.getByRole("button", { name: "適用" }).click();
  await expect(page.getByTestId("shop-card")).toHaveCount(1);
  await expect(page).toHaveURL(/genre=washoku/);
});

test("地図キーがない環境では地図の読み込みエラーを出し、絞り込みはそのまま使える", async ({ page }) => {
  test.skip(!!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, "Maps キーがある環境ではスキップ");
  await page.goto("/map");
  await expect(page.getByText("地図を読み込めませんでした")).toBeVisible();
  await expect(page.getByRole("link", { name: "店名・ジャンルでさがす" })).toHaveAttribute("href", "/search");
  await page.getByRole("button", { name: "気になるだけ" }).click();
  await expect(page).toHaveURL(/want=true/);
  await expect(page.getByText("地図を読み込めませんでした")).toBeVisible();
});

test("不正なクエリ値は無視され、500 にならず通常表示される", async ({ page }) => {
  const res = await page.goto("/search?smoking=%22x&genre=unknown,%29&q=" + "a".repeat(300));
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("result-count")).toBeVisible();
  const res2 = await page.goto("/map?smoking=%22x");
  expect(res2?.status()).toBe(200);
});

test("リストタブで公開リストだけが出て、タブは URL に残る", async ({ page }) => {
  const owner = await createTestUser(uniqueId("lo"));
  const tag = uniqueId("pl");
  const admin = adminClient();
  const { error } = await admin.from("lists").insert([
    { owner_id: owner.id, name: `${tag}公開`, kind: "favorite", is_public: true },
    { owner_id: owner.id, name: `${tag}非公開`, kind: "favorite", is_public: false },
  ]);
  if (error) throw error;

  await page.goto("/search");
  await page.getByRole("tab", { name: "リスト" }).click();
  await expect(page).toHaveURL(/tab=lists/);
  await page.getByRole("searchbox", { name: "リスト名でさがす" }).fill(tag);
  const cards = page.getByTestId("public-list-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(`${tag}公開`);
  await expect(cards.first()).toContainText("マイリスト・お気に入り");
  await expect(page.getByText(`${tag}非公開`)).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(/tab=lists/);
  await expect(cards).toHaveCount(1);
});
