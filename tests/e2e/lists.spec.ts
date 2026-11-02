import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, createShop, createTestUser, createVisit, TEST_PASSWORD, uniqueId } from "../db/helpers";

// このファイルでは自分で作ったユーザーでログインし直す。
test.use({ storageState: { cookies: [], origins: [] } });

async function newUser(prefix: string, opts: { admin?: boolean } = {}) {
  const loginId = uniqueId(prefix);
  const user = await createTestUser(loginId, opts);
  return { ...user, loginId };
}

/** 既定の「気になる」「お気に入り」（どちらも非公開）を作る。サインアップが行うのと同じ。 */
async function createDefaultLists(userId: string) {
  const { data, error } = await adminClient()
    .from("lists")
    .insert([
      { owner_id: userId, name: "気になる", kind: "want", is_public: false, is_default: true },
      { owner_id: userId, name: "お気に入り", kind: "favorite", is_public: false, is_default: true },
    ])
    .select("id, kind");
  if (error) throw error;
  return {
    want: data.find((l) => l.kind === "want")!.id as string,
    favorite: data.find((l) => l.kind === "favorite")!.id as string,
  };
}

async function addItem(listId: string, shopId: string) {
  const { error } = await adminClient().from("list_items").insert({ list_id: listId, shop_id: shopId });
  if (error) throw error;
}

async function loginAs(page: Page, loginId: string) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(loginId);
  await page.getByLabel("パスワード").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/map$/);
}

async function asUser(browser: Browser, loginId: string) {
  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await loginAs(page, loginId);
  return { context, page };
}

test("Aが新しい公開リストを作って店を追加すると、Bは /users/a でそれだけ見られ、管理者が店を削除しても件数が減るだけ", async ({
  browser,
}) => {
  const a = await newUser("la");
  const b = await newUser("lb");
  const admin = await newUser("ladm", { admin: true });
  const lists = await createDefaultLists(a.id);
  const shopId = await createShop(a.id, { name: "二次会テスト酒場" });
  const otherShop = await createShop(a.id, { name: "二次会テスト別店" });
  await addItem(lists.want, shopId); // 非公開の既定リストにも入れておく

  const A = await asUser(browser, a.loginId);
  await A.page.goto(`/shops/${shopId}`);
  await A.page.getByRole("button", { name: /お気に入り/ }).click();
  const sheet = A.page.getByRole("dialog", { name: "「お気に入り」のリストに追加" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("checkbox")).toHaveCount(1); // 既定の「お気に入り」だけ（まだ入っていない）
  await sheet.getByRole("button", { name: "＋ 新しいリストを作る" }).click();
  await sheet.getByLabel("リスト名").fill("2次会向き");
  await sheet.getByRole("checkbox", { name: "共有する（ログインしている人が見られます）" }).check();
  await sheet.getByRole("button", { name: "作る" }).click();
  await expect(sheet.getByRole("checkbox", { name: /2次会向き/ })).toBeChecked();
  await sheet.getByRole("button", { name: "完了" }).click();
  await expect(A.page.getByRole("button", { name: /♥ お気に入り/ })).toHaveAttribute("aria-pressed", "true");

  // 2 店目も同じリストに入れる
  await A.page.goto(`/shops/${otherShop}`);
  await A.page.getByRole("button", { name: /お気に入り/ }).click();
  await A.page.getByRole("checkbox", { name: /2次会向き/ }).check();
  await A.page.getByRole("button", { name: "完了" }).click();
  await expect(A.page.getByRole("button", { name: /♥ お気に入り/ })).toHaveAttribute("aria-pressed", "true");
  await A.context.close();

  const B = await asUser(browser, b.loginId);
  await B.page.goto(`/users/${a.loginId}`);
  await expect(B.page.getByText("2次会向き")).toBeVisible();
  await expect(B.page.getByText("気になる", { exact: true })).toHaveCount(0);
  await expect(B.page.getByText("2店")).toBeVisible();
  await B.page.getByRole("link", { name: /2次会向き/ }).click();
  await expect(B.page).toHaveURL(/\/lists\/[0-9a-f-]+$/);
  const listUrl = B.page.url();
  await expect(B.page.getByTestId("shop-card")).toHaveCount(2);
  await expect(B.page.getByTestId("list-count")).toHaveText("2店");

  // 管理者が 1 店を論理削除する（Review Focus 5）
  const rpc = await admin.client.rpc("soft_delete_shop", { p_shop: shopId });
  expect(rpc.error).toBeNull();

  const res = await B.page.goto(listUrl);
  expect(res?.status()).toBe(200);
  await expect(B.page.getByTestId("shop-card")).toHaveCount(1);
  await expect(B.page.getByTestId("list-count")).toHaveText("1店");
  await expect(B.page.getByText("二次会テスト別店")).toBeVisible();
  await B.context.close();
});

test("他人の非公開リストは 404、存在しないユーザーも 404", async ({ browser }) => {
  const a = await newUser("lc");
  const b = await newUser("ld");
  const lists = await createDefaultLists(a.id);
  const B = await asUser(browser, b.loginId);
  await B.page.goto(`/lists/${lists.want}`);
  await expect(B.page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await B.page.goto("/users/no_such_user_zz");
  await expect(B.page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await B.page.goto("/lists/not-a-uuid");
  await expect(B.page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await B.context.close();
});

test("「気になる」シートは既定のリストを先頭に並べ、チェックで入れる・外すができる", async ({ browser }) => {
  const a = await newUser("le");
  const lists = await createDefaultLists(a.id);
  const { data: extra, error } = await adminClient()
    .from("lists")
    .insert({ owner_id: a.id, name: "aaa 先頭になりたい", kind: "want", is_public: false })
    .select("id")
    .single();
  if (error) throw error;
  const shopId = await createShop(a.id, { name: "シートテスト酒場" });
  await addItem(lists.want, shopId);

  const A = await asUser(browser, a.loginId);
  await A.page.goto(`/shops/${shopId}`);
  await expect(A.page.getByRole("button", { name: /★ 気になる/ })).toHaveAttribute("aria-pressed", "true");
  await A.page.getByRole("button", { name: /気になる/ }).click();
  const sheet = A.page.getByRole("dialog", { name: "「気になる」のリストに追加" });
  const boxes = sheet.getByRole("checkbox");
  await expect(boxes).toHaveCount(2);
  await expect(boxes.nth(0)).toBeChecked(); // 既定のリストが先頭、入っているのでチェック済み
  await expect(boxes.nth(0)).toHaveAccessibleName(/気になる.*既定/);
  await expect(boxes.nth(1)).not.toBeChecked();

  await boxes.nth(0).uncheck();
  await sheet.getByRole("button", { name: "完了" }).click();
  await expect(A.page.getByRole("button", { name: /☆ 気になる/ })).toHaveAttribute("aria-pressed", "false");
  const rows = await adminClient().from("list_items").select("list_id").eq("shop_id", shopId);
  expect(rows.data).toEqual([]);
  void extra;
  await A.context.close();
});

test("リストの持ち主は名前の変更・公開の切り替え・削除ができるが、既定のリストは削除できない", async ({ browser }) => {
  const a = await newUser("lf");
  const lists = await createDefaultLists(a.id);
  const { data: mine, error } = await adminClient()
    .from("lists")
    .insert({ owner_id: a.id, name: "編集前の名前", kind: "favorite", is_public: false })
    .select("id")
    .single();
  if (error) throw error;

  const A = await asUser(browser, a.loginId);
  await A.page.goto(`/lists/${lists.favorite}`);
  await A.page.getByRole("button", { name: "編集" }).click();
  await expect(A.page.getByRole("button", { name: "リストを削除" })).toHaveCount(0);

  await A.page.goto(`/lists/${mine.id}`);
  await A.page.getByRole("button", { name: "編集" }).click();
  await A.page.getByLabel("リスト名").fill("編集後の名前");
  await A.page.getByRole("checkbox", { name: "共有する（ログインしている人が見られます）" }).check();
  await A.page.getByRole("button", { name: "保存" }).click();
  await expect(A.page.getByRole("heading", { name: "編集後の名前" })).toBeVisible();
  await expect(A.page.getByText(/共有（ログインしている人が見られます）/)).toBeVisible();

  await A.page.getByRole("button", { name: "編集" }).click();
  await A.page.getByRole("button", { name: "リストを削除" }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page).toHaveURL(/\/me/);
  await expect(A.page.getByText("編集後の名前")).toHaveCount(0);
  await A.context.close();
});

test("マイページ: マイリスト・自分の記録・アカウント（ニックネーム変更、パスワード変更、管理者カード）", async ({
  browser,
}) => {
  const a = await newUser("lg", { admin: true });
  await createDefaultLists(a.id);
  const shopId = await createShop(a.id, { name: "記録タブ酒場" });
  await createVisit(shopId, a.id, {
    visited_on: "2026-03-01",
    purpose: "celebration",
    comment: "これは四十文字を超える長いコメントです。これは四十文字を超える長いコメントです。これは四十文字を超える長いコメントです。",
  });

  const A = await asUser(browser, a.loginId);
  await A.page.goto("/me");
  await expect(A.page.getByRole("link", { name: /気になる/ })).toBeVisible();
  await A.page.getByRole("tab", { name: "共有リスト" }).click();
  await expect(A.page.getByRole("button", { name: "＋ メンバーで編集するリストを作る" })).toBeVisible();

  await A.page.getByRole("tab", { name: "自分の記録" }).click();
  const log = A.page.getByRole("link", { name: /記録タブ酒場/ });
  await expect(log).toContainText("2026-03-01");
  await expect(log).toContainText("打ち上げ");
  await expect(log).toContainText("…");

  await A.page.getByRole("tab", { name: "アカウント" }).click();
  await expect(A.page.getByRole("link", { name: /管理画面/ })).toHaveAttribute("href", "/admin");
  await A.page.getByLabel("ニックネーム").fill("あたらしい名前");
  await A.page.getByRole("button", { name: "ニックネームを保存" }).click();
  await expect(A.page.getByText("ニックネームを変更しました")).toBeVisible();
  const prof = await adminClient().from("profiles").select("nickname").eq("id", a.id).single();
  expect(prof.data?.nickname).toBe("あたらしい名前");

  await A.page.getByRole("button", { name: "パスワードを変更" }).click();
  await A.page.getByLabel("新しいパスワード", { exact: true }).fill("short");
  await A.page.getByLabel("新しいパスワード（確認）").fill("short");
  await A.page.getByRole("button", { name: "パスワードを更新" }).click();
  await expect(A.page.getByText("パスワードは8文字以上にしてください")).toBeVisible();
  await A.page.getByLabel("新しいパスワード", { exact: true }).fill("new-password-5678");
  await A.page.getByLabel("新しいパスワード（確認）").fill("different-5678");
  await A.page.getByRole("button", { name: "パスワードを更新" }).click();
  await expect(A.page.getByText("確認用のパスワードが一致しません")).toBeVisible();
  await A.page.getByLabel("新しいパスワード（確認）").fill("new-password-5678");
  await A.page.getByRole("button", { name: "パスワードを更新" }).click();
  await expect(A.page.getByText("パスワードを変更しました")).toBeVisible();

  await A.page.getByRole("button", { name: "ログアウト" }).click();
  await expect(A.page).toHaveURL(/\/login/);
  await A.context.close();
});

test("どのリストにも入っていない店で「気になる」を押すと、既定のリストに入った状態でシートが開く。外して閉じ、もう一度押すと入れ直される", async ({
  browser,
}) => {
  const a = await newUser("lh");
  const lists = await createDefaultLists(a.id);
  const shopId = await createShop(a.id, { name: "自動追加テスト酒場" });
  const itemCount = async () => {
    const r = await adminClient().from("list_items").select("list_id").eq("shop_id", shopId);
    return (r.data ?? []).filter((i) => i.list_id === lists.want).length;
  };

  const A = await asUser(browser, a.loginId);
  await A.page.goto(`/shops/${shopId}`);
  await expect(A.page.getByRole("button", { name: /☆ 気になる/ })).toHaveAttribute("aria-pressed", "false");

  // (a) 押すと既定の「気になる」に入り、チェック済みで開く。閉じるとボタンが塗りつぶし
  await A.page.getByRole("button", { name: /気になる/ }).click();
  const sheet = A.page.getByRole("dialog", { name: "「気になる」のリストに追加" });
  await expect(sheet.getByRole("checkbox", { name: /気になる.*既定/ })).toBeChecked();
  expect(await itemCount()).toBe(1);
  await sheet.getByRole("button", { name: "完了" }).click();
  await expect(A.page.getByRole("button", { name: /★ 気になる/ })).toHaveAttribute("aria-pressed", "true");

  // (b) 外して閉じる → どのリストにも入っていない → もう一度押すと入れ直される
  await A.page.getByRole("button", { name: /気になる/ }).click();
  await sheet.getByRole("checkbox", { name: /気になる.*既定/ }).uncheck();
  await expect.poll(itemCount).toBe(0);
  await sheet.getByRole("button", { name: "完了" }).click();
  await expect(A.page.getByRole("button", { name: /☆ 気になる/ })).toHaveAttribute("aria-pressed", "false");
  await A.page.getByRole("button", { name: /気になる/ }).click();
  await expect(sheet.getByRole("checkbox", { name: /気になる.*既定/ })).toBeChecked();
  expect(await itemCount()).toBe(1);
  await sheet.getByRole("button", { name: "完了" }).click();

  // 「＋ リスト」は自動で追加しない（お気に入りの既定リストは空のまま）
  await A.page.getByRole("button", { name: "＋ リスト" }).click();
  const any = A.page.getByRole("dialog", { name: "リストに追加" });
  await expect(any.getByRole("checkbox", { name: /お気に入り/ })).not.toBeChecked();
  await any.getByRole("button", { name: "完了" }).click();
  const fav = await adminClient().from("list_items").select("id").eq("list_id", lists.favorite);
  expect(fav.data).toEqual([]);
  await A.context.close();
});
