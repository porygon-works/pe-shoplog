import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, createShop, createTestUser, TEST_PASSWORD, uniqueId } from "../db/helpers";

// このファイルでは自分で作ったユーザーでログインし直す。
test.use({ storageState: { cookies: [], origins: [] } });

async function newUser(prefix: string) {
  const loginId = uniqueId(prefix);
  const user = await createTestUser(loginId);
  return { ...user, loginId };
}

async function fillLogin(page: Page, loginId: string) {
  await page.getByLabel("ユーザーID").fill(loginId);
  await page.getByLabel("パスワード").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
}

async function asUser(browser: Browser, loginId: string) {
  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await page.goto("/login");
  await fillLogin(page, loginId);
  await expect(page).toHaveURL(/\/map$/);
  return { context, page };
}

test("共有リスト: 作成 → 招待 → 参加 → メモ付きで追加 → 再訪は直接開く → 作り直しで古いリンクは無効", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const a = await newUser("sa");
  const b = await newUser("sb");
  const c = await newUser("sc");
  const shopId = await createShop(a.id, { name: "共有テスト酒場" });
  const listName = `Q4候補${uniqueId("")}`.slice(0, 20);

  // A が /me から共有リストを作る
  const A = await asUser(browser, a.loginId);
  await A.page.goto("/me");
  await A.page.getByRole("tab", { name: "共有リスト" }).click();
  await A.page.getByRole("button", { name: "＋ 共有リストを作る" }).click();
  await A.page.getByLabel("リスト名").fill(listName);
  await A.page.getByLabel("説明").fill("開発チームの打ち上げ候補");
  await A.page.getByRole("button", { name: "作る" }).click();
  await expect(A.page).toHaveURL(/\/shared\/[0-9a-f-]+$/);
  const listUrl = A.page.url();
  const listId = listUrl.split("/").pop()!;
  await expect(A.page.getByRole("heading", { name: listName })).toBeVisible();

  const inviteInput = A.page.getByLabel("招待リンク");
  const inviteUrl = await inviteInput.inputValue();
  expect(inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\/[0-9a-f]{32}$/);
  await A.page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await A.page.getByRole("button", { name: "コピー" }).click();
  await expect(A.page.getByText("招待リンクをコピーしました")).toBeVisible();

  // B がリンクから参加し、メモ付きで店を追加する
  const B = await asUser(browser, b.loginId);
  await B.page.goto(inviteUrl);
  await expect(B.page.getByText(`${a.loginId} さんから招待されています`)).toBeVisible();
  await expect(B.page.getByText(listName)).toBeVisible();
  await B.page.getByRole("button", { name: "参加する" }).click();
  await expect(B.page).toHaveURL(new RegExp(`/shared/${listId}$`));

  await B.page.goto(`/shops/${shopId}`);
  await B.page.getByRole("button", { name: "＋ リスト" }).click();
  const sheet = B.page.getByRole("dialog", { name: "リストに追加" });
  await expect(sheet.getByText("共有リスト", { exact: true })).toBeVisible();
  await sheet.getByLabel(`メモ（${listName}）`).fill("個室あり、15人まで");
  await sheet.getByRole("checkbox", { name: new RegExp(listName) }).check();
  await expect
    .poll(async () => {
      const r = await adminClient().from("shared_list_items").select("note, added_by").eq("shared_list_id", listId);
      return r.data;
    })
    .toEqual([{ note: "個室あり、15人まで", added_by: b.id }]);
  await sheet.getByRole("button", { name: "完了" }).click();

  // A のページに店と B のニックネームが出る
  await A.page.reload();
  await expect(A.page.getByTestId("shop-card")).toHaveCount(1);
  await expect(A.page.getByText("共有テスト酒場")).toBeVisible();
  await expect(A.page.getByText(`${b.loginId}：個室あり、15人まで`)).toBeVisible();
  await expect(A.page.getByText("メンバー", { exact: true })).toBeVisible();

  // B がもう一度同じリンクを開くと、そのままリストが開く
  await B.page.goto(inviteUrl);
  await expect(B.page).toHaveURL(new RegExp(`/shared/${listId}$`));
  await expect(B.page.getByRole("button", { name: "参加する" })).toHaveCount(0);

  // A がリンクを作り直す
  await A.page.getByRole("button", { name: /リンクを作り直す/ }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page.getByText("新しい招待リンクを作りました")).toBeVisible();
  await expect.poll(() => A.page.getByLabel("招待リンク").inputValue()).not.toBe(inviteUrl);
  const newInviteUrl = await A.page.getByLabel("招待リンク").inputValue();

  // 未ログインの C が古いリンクを開く → ログイン後に「無効」
  const ctxC = await browser.newContext({ baseURL: "http://localhost:3000" });
  const pageC = await ctxC.newPage();
  await pageC.goto(inviteUrl);
  await expect(pageC).toHaveURL(/\/login\?next=/);
  await fillLogin(pageC, c.loginId);
  await expect(pageC.getByText("この招待リンクは無効です")).toBeVisible();
  await expect(pageC.getByRole("button", { name: "参加する" })).toHaveCount(0);
  // 非メンバーの非公開リストは 404
  const res = await pageC.goto(`/shared/${listId}`);
  expect(res?.status()).toBe(404);
  // 新しいリンクなら参加できる
  await pageC.goto(newInviteUrl);
  await pageC.getByRole("button", { name: "参加する" }).click();
  await expect(pageC).toHaveURL(new RegExp(`/shared/${listId}$`));

  // C は抜けられる（オーナーには抜けるボタンが無い）
  await pageC.getByRole("button", { name: "このリストから抜ける" }).click();
  await pageC.getByRole("button", { name: "OK" }).click();
  await expect(pageC).toHaveURL(/\/me/);
  await expect(A.page.getByRole("button", { name: "このリストから抜ける" })).toHaveCount(0);

  // A は B を外せる
  await A.page.reload();
  await A.page.getByRole("button", { name: `${b.loginId} を外す` }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page.getByRole("button", { name: `${b.loginId} を外す` })).toHaveCount(0);
  const members = await adminClient().from("shared_list_members").select("user_id").eq("shared_list_id", listId);
  expect(members.data).toEqual([{ user_id: a.id }]);

  // A は設定を変えて、リストを削除できる
  await A.page.getByRole("button", { name: "設定" }).click();
  await A.page.getByLabel("リスト名").fill("改名後の共有リスト");
  await A.page.getByRole("checkbox", { name: "公開する" }).check();
  await A.page.getByRole("button", { name: "保存" }).click();
  await expect(A.page.getByRole("heading", { name: "改名後の共有リスト" })).toBeVisible();
  await A.page.getByRole("button", { name: "設定" }).click();
  await A.page.getByRole("button", { name: "リストを削除" }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page).toHaveURL(/\/me/);
  const gone = await adminClient().from("shared_lists").select("id").eq("id", listId);
  expect(gone.data).toEqual([]);

  await A.context.close();
  await B.context.close();
  await ctxC.close();
});

test("公開の共有リストは非メンバーが読み取り専用で見られ、メンバー一覧にも出る", async ({ browser }) => {
  const a = await newUser("sd");
  const b = await newUser("se");
  const shopId = await createShop(a.id, { name: "公開共有酒場" });
  const { data: list, error } = await adminClient()
    .from("shared_lists")
    .insert({ owner_id: a.id, name: "公開の共有", is_public: true })
    .select("id")
    .single();
  if (error) throw error;
  await adminClient().from("shared_list_items").insert({ shared_list_id: list.id, shop_id: shopId, added_by: null });

  const B = await asUser(browser, b.loginId);
  await B.page.goto(`/shared/${list.id}`);
  await expect(B.page.getByRole("heading", { name: "公開の共有" })).toBeVisible();
  await expect(B.page.getByText("公開共有酒場")).toBeVisible();
  await expect(B.page.getByText("退会したユーザーが追加")).toBeVisible();
  await expect(B.page.getByLabel("招待リンク")).toHaveCount(0);
  await expect(B.page.getByRole("button", { name: "設定" })).toHaveCount(0);
  await expect(B.page.getByRole("button", { name: "このリストから抜ける" })).toHaveCount(0);
  await B.context.close();
});

test("不正な招待トークン・ID は無効／404", async ({ browser }) => {
  const a = await newUser("sf");
  const A = await asUser(browser, a.loginId);
  await A.page.goto("/invite/not-a-real-token");
  await expect(A.page.getByText("この招待リンクは無効です")).toBeVisible();
  const res = await A.page.goto("/shared/not-a-uuid");
  expect(res?.status()).toBe(404);
  await A.context.close();
});
