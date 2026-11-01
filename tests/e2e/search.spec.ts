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

test("喫煙のドロップダウン（登録と同じ選択肢）で絞り込むと該当の店だけが残り、URL に残って再読み込みでも保たれる", async ({
  page,
}) => {
  const { tag } = await fixture();
  await page.goto(`/search?q=${tag}`);
  const cards = page.getByTestId("shop-card");
  await expect(cards).toHaveCount(3);

  await page.getByLabel("喫煙", { exact: true }).selectOption({ label: "禁煙" });
  await expect(page).toHaveURL(/smoking=no_smoking/);
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(`${tag}禁煙食堂`);
  await expect(page.getByTestId("result-count")).toHaveText("1件");

  await page.reload();
  await expect(cards).toHaveCount(1);
  await expect(page.getByLabel("喫煙", { exact: true })).toHaveValue("no_smoking");

  await page.getByLabel("喫煙", { exact: true }).selectOption({ label: "分煙・喫煙室あり" });
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(`${tag}喫煙酒場`);

  await page.getByLabel("喫煙", { exact: true }).selectOption({ label: "喫煙" });
  await expect(cards).toHaveCount(3);
});

test("ジャンル・用途もドロップダウンで絞り込める", async ({ page }) => {
  const { tag } = await fixture();
  await page.goto(`/search?q=${tag}`);
  await page.getByLabel("ジャンル", { exact: true }).selectOption({ label: "和食" });
  await expect(page.getByTestId("shop-card")).toHaveCount(1);
  await expect(page).toHaveURL(/genre=washoku/);
  await page.getByLabel("ジャンル", { exact: true }).selectOption({ label: "ジャンル" });
  await page.getByLabel("用途", { exact: true }).selectOption({ label: "打ち上げ" });
  await expect(page.getByTestId("shop-card")).toHaveCount(1);
  await expect(page.getByTestId("shop-card").first()).toContainText(`${tag}喫煙酒場`);
});

test("地図キーがない環境では地図の読み込みエラーを出し、絞り込みはそのまま使える", async ({ page }) => {
  test.skip(!!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, "Maps キーがある環境ではスキップ");
  await page.goto("/map");
  await expect(page.getByText("地図を読み込めませんでした")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "お店をさがす" })).toBeVisible();
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
