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

async function createSharedFixture(ownerId: string, name: string, memberIds: string[] = []) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("shared_lists")
    .insert({ owner_id: ownerId, name })
    .select("id, invite_token")
    .single();
  if (error) throw error;
  for (const userId of memberIds) {
    const r = await admin.from("shared_list_members").insert({ shared_list_id: data.id, user_id: userId, role: "member" });
    if (r.error) throw r.error;
  }
  return { id: data.id as string, token: data.invite_token as string };
}

test("共有リスト(a): 作成 → 招待リンク → 参加 → メモ付きで追加 → Aのページに出る → 再訪は直接開く", async ({
  browser,
}) => {
  const a = await newUser("sa");
  const b = await newUser("sb");
  const shopId = await createShop(a.id, { name: "共有テスト酒場" });
  const listName = `Q4候補${uniqueId("")}`.slice(0, 20);

  const A = await asUser(browser, a.loginId);
  await A.page.goto("/me");
  await A.page.getByRole("tab", { name: "共有リスト" }).click();
  await A.page.getByRole("button", { name: "＋ メンバーで編集するリストを作る" }).click();
  await A.page.getByLabel("リスト名").fill(listName);
  await A.page.getByLabel("説明").fill("開発チームの打ち上げ候補");
  await A.page.getByRole("button", { name: "作る" }).click();
  await expect(A.page).toHaveURL(/\/shared\/[0-9a-f-]+$/);
  const listId = A.page.url().split("/").pop()!;
  await expect(A.page.getByRole("heading", { name: listName })).toBeVisible();

  const inviteUrl = await A.page.getByLabel("招待リンク").inputValue();
  expect(inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\/[0-9a-f]{32}$/);
  await A.page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await A.page.getByRole("button", { name: "コピー" }).click();
  await expect(A.page.getByText("招待リンクをコピーしました")).toBeVisible();

  const B = await asUser(browser, b.loginId);
  await B.page.goto(inviteUrl);
  await expect(B.page.getByText(`${a.loginId} さんから招待されています`)).toBeVisible();
  await expect(B.page.getByText(listName)).toBeVisible();
  await B.page.getByRole("button", { name: "参加する" }).click();
  await expect(B.page).toHaveURL(new RegExp(`/shared/${listId}$`));

  await B.page.goto(`/shops/${shopId}`);
  await B.page.getByRole("button", { name: "＋ リスト" }).click();
  const sheet = B.page.getByRole("dialog", { name: "リストに追加" });
  await expect(sheet.getByText("メンバーで編集する共有リスト", { exact: true })).toBeVisible();
  await sheet.getByLabel(`メモ（${listName}）`).fill("個室あり、15人まで");
  await sheet.getByRole("checkbox", { name: new RegExp(listName) }).check();
  await expect
    .poll(async () => {
      const r = await adminClient().from("shared_list_items").select("note, added_by").eq("shared_list_id", listId);
      return r.data;
    })
    .toEqual([{ note: "個室あり、15人まで", added_by: b.id }]);
  // 追加者本人は後からメモを直せる。変更があるときだけ「保存」が押せる。
  const save = sheet.getByRole("button", { name: `メモを保存（${listName}）` });
  await expect(save).toBeDisabled();
  await sheet.getByLabel(`メモ（${listName}）`).fill("個室あり、20人まで");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(B.page.getByText("メモを保存しました")).toBeVisible();
  await expect(save).toBeDisabled();
  await sheet.getByRole("button", { name: "完了" }).click();

  await A.page.reload();
  await expect(A.page.getByTestId("shop-card")).toHaveCount(1);
  await expect(A.page.getByText("共有テスト酒場")).toBeVisible();
  await expect(A.page.getByText(`${b.loginId}：個室あり、20人まで`)).toBeVisible();

  await B.page.goto(inviteUrl);
  await expect(B.page).toHaveURL(new RegExp(`/shared/${listId}$`));
  await expect(B.page.getByRole("button", { name: "参加する" })).toHaveCount(0);
  await A.context.close();
  await B.context.close();
});

test("共有リスト: 他のメンバーが追加した店のメモは書き換えられない（表示は読み取り専用、古い画面からの保存も拒否）", async ({
  browser,
}) => {
  const a = await newUser("sg");
  const b = await newUser("sh");
  const shopId = await createShop(a.id, { name: "メモ保護酒場" });
  const listName = `メモ保護${uniqueId("")}`.slice(0, 20);
  const list = await createSharedFixture(a.id, listName, [b.id]);

  const B = await asUser(browser, b.loginId);
  // B の画面を先に開く（まだ店は入っていない）
  await B.page.goto(`/shops/${shopId}`);
  await B.page.getByRole("button", { name: "＋ リスト" }).click();
  const sheet = B.page.getByRole("dialog", { name: "リストに追加" });
  const box = sheet.getByRole("checkbox", { name: new RegExp(listName) });
  await expect(box).not.toBeChecked();

  // その間に A が店とメモを追加する
  const ins = await adminClient()
    .from("shared_list_items")
    .insert({ shared_list_id: list.id, shop_id: shopId, added_by: a.id, note: "Aのメモ" });
  if (ins.error) throw ins.error;

  // 古い画面の B がメモを付けて入れようとしても、A のメモは変わらずエラーになる
  await sheet.getByLabel(`メモ（${listName}）`).fill("Bが書き換え");
  await box.check();
  await expect(B.page.getByText("メモは追加した人だけが編集できます")).toBeVisible();
  const row = await adminClient().from("shared_list_items").select("note, added_by").eq("shared_list_id", list.id).single();
  expect(row.data).toEqual({ note: "Aのメモ", added_by: a.id });

  // 開き直すと A のメモは読み取り専用で、保存ボタンは出ない
  await B.page.reload();
  await B.page.getByRole("button", { name: "＋ リスト" }).click();
  const sheet2 = B.page.getByRole("dialog", { name: "リストに追加" });
  await expect(sheet2.getByText(`${a.loginId}：Aのメモ`)).toBeVisible();
  await expect(sheet2.getByLabel(`メモ（${listName}）`)).toHaveCount(0);
  await expect(sheet2.getByRole("button", { name: `メモを保存（${listName}）` })).toHaveCount(0);
  // 入れる・外すは誰でもできる
  await sheet2.getByRole("checkbox", { name: new RegExp(listName) }).uncheck();
  await expect
    .poll(async () => (await adminClient().from("shared_list_items").select("shop_id").eq("shared_list_id", list.id)).data)
    .toEqual([]);
  await B.context.close();
});

test("共有リスト(b): リンクを作り直すと古いリンクは無効。未ログインでもログイン後に戻る", async ({ browser }) => {
  const a = await newUser("si");
  const c = await newUser("sc");
  const list = await createSharedFixture(a.id, `作り直し${uniqueId("")}`.slice(0, 20));
  const inviteUrl = `http://localhost:3000/invite/${list.token}`;

  const A = await asUser(browser, a.loginId);
  await A.page.goto(`/shared/${list.id}`);
  await expect(A.page.getByLabel("招待リンク")).toHaveValue(inviteUrl);
  await A.page.getByRole("button", { name: /リンクを作り直す/ }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page.getByText("新しい招待リンクを作りました")).toBeVisible();
  await expect.poll(() => A.page.getByLabel("招待リンク").inputValue()).not.toBe(inviteUrl);
  const newInviteUrl = await A.page.getByLabel("招待リンク").inputValue();

  const ctxC = await browser.newContext({ baseURL: "http://localhost:3000" });
  const pageC = await ctxC.newPage();
  await pageC.goto(inviteUrl);
  await expect(pageC).toHaveURL(/\/login\?next=/);
  await fillLogin(pageC, c.loginId);
  await expect(pageC.getByText("この招待リンクは無効です")).toBeVisible();
  await expect(pageC.getByRole("button", { name: "参加する" })).toHaveCount(0);
  await pageC.goto(`/shared/${list.id}`);
  await expect(pageC.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await pageC.goto(newInviteUrl);
  await pageC.getByRole("button", { name: "参加する" }).click();
  await expect(pageC).toHaveURL(new RegExp(`/shared/${list.id}$`));
  await A.context.close();
  await ctxC.close();
});

test("共有リスト(c): メンバーの退出・オーナーが外す・設定変更・削除", async ({ browser }) => {
  const a = await newUser("sj");
  const b = await newUser("sk");
  const c = await newUser("sl");
  const list = await createSharedFixture(a.id, `管理${uniqueId("")}`.slice(0, 20), [b.id, c.id]);

  const C = await asUser(browser, c.loginId);
  await C.page.goto(`/shared/${list.id}`);
  await C.page.getByRole("button", { name: "このリストから抜ける" }).click();
  await C.page.getByRole("button", { name: "OK" }).click();
  await expect(C.page).toHaveURL(/\/me/);

  const A = await asUser(browser, a.loginId);
  await A.page.goto(`/shared/${list.id}`);
  await expect(A.page.getByRole("button", { name: "このリストから抜ける" })).toHaveCount(0);
  await A.page.getByRole("button", { name: `${b.loginId} を外す` }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page.getByRole("button", { name: `${b.loginId} を外す` })).toHaveCount(0);
  const members = await adminClient().from("shared_list_members").select("user_id").eq("shared_list_id", list.id);
  expect(members.data).toEqual([{ user_id: a.id }]);

  await A.page.getByRole("button", { name: "設定" }).click();
  await A.page.getByLabel("リスト名").fill("改名後の共有リスト");
  await A.page.getByRole("checkbox", { name: "メンバー以外にも共有する（見るだけ）" }).check();
  await A.page.getByRole("button", { name: "保存" }).click();
  await expect(A.page.getByRole("heading", { name: "改名後の共有リスト" })).toBeVisible();
  await A.page.getByRole("button", { name: "設定" }).click();
  await A.page.getByRole("button", { name: "リストを削除" }).click();
  await A.page.getByRole("button", { name: "OK" }).click();
  await expect(A.page).toHaveURL(/\/me/);
  const gone = await adminClient().from("shared_lists").select("id").eq("id", list.id);
  expect(gone.data).toEqual([]);
  await A.context.close();
  await C.context.close();
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
  await A.page.goto("/shared/not-a-uuid");
  await expect(A.page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await A.context.close();
});
