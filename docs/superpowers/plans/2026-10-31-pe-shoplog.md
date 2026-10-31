# PE ショップログ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 社員向けのお店ログ（お店・行った記録・写真・マイリスト・共有リスト・Google マップ連携）を、スマホ向け PWA として Vercel＋Supabase 上に作る。

**Architecture:** Next.js 16 App Router。読み取りは Server Components、書き込みは Server Actions で行う。権限は Supabase の RLS で守り、管理系の操作だけ secret キーのクライアントを使う。Google Places は Route Handler 経由で呼び、ブラウザには Maps JS 用のキーしか出さない。お店の代表値（喫煙・値段感など）は SQL ビュー `shop_index` で計算し、絞り込みも同じビューに対して行う。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind CSS v4 / @supabase/ssr + @supabase/supabase-js / Supabase CLI（ローカル DB とマイグレーション）/ @vis.gl/react-google-maps / nuqs / zod / Vitest / Playwright

**Spec:** `docs/superpowers/specs/2026-10-31-pe-shoplog-design.md`（必ず併読する。参考資料は `docs/reference/NEW_PROJECT_PLAYBOOK.md`）

## Global Constraints

- Node.js 20.9 以上。Next.js 16 では `src/proxy.ts`（旧 middleware）を使う。`next lint` は使わず `eslint .`（flat config）。`params`・`searchParams`・`cookies()` は `await` する。
- Supabase のキーは新形式: ブラウザ・SSR 用は `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、サーバーの管理操作用は `SUPABASE_SECRET_KEY`。secret キーは `src/lib/supabase/admin.ts` 以外で読まない。
- サーバー側の認証確認は `supabase.auth.getClaims()` で行う。`getSession()` の中身は信用しない。
- 環境変数: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`, `GOOGLE_PLACES_API_KEY`, `CRON_SECRET`
- Supabase Auth の公開サインアップは無効にする（`supabase/config.toml` の `[auth] enable_signup = false`、本番はダッシュボードで同じ設定）。
- ダミーメールアドレスは `{loginId}@users.pe-shoplog.invalid`。ドメインは定数 `AUTH_EMAIL_DOMAIN` だけで管理する。
- ユーザーID は `^[a-z0-9_]{3,20}$`（入力は小文字に正規化してから検証する）。ニックネームは 1〜20 文字、パスワードは 8 文字以上、コメントは 1,000 文字まで、写真は 1 記録あたり 10 枚まで。
- 合言葉は大文字・小文字を区別しない（照合前に trim して小文字化する）。新規登録の試行は同じ IP から 1 時間に 10 回まで。
- 選択肢の値は `text` と CHECK 制約で持つ。「不明」は `'unknown'`。値の一覧は Task 2 の `src/lib/options.ts` が唯一の定義元で、マイグレーションの CHECK 制約と一致させる。
- ユーザーが作るデータは `deleted_at` で論理削除する。一覧・集計・リスト表示では `deleted_at is null` のものだけを扱う。
- RLS では `auth.uid()` を `(select auth.uid())` と書く。ポリシーで使う列にはインデックスを張る。
- 写真: 長辺 1600px、JPEG 品質 0.8、canvas で再エンコードして EXIF を消す。保存パスは `shops/{shop_id}/visits/{visit_id}/{uuid}.jpg`、非公開バケット `photos`、表示は有効期限 1 時間の署名付き URL。
- Places のフィールドマスク: 店を選んだとき `id,displayName,location`、公式サイトは `websiteUri`、位置更新は `location`。サイト URL・住所・営業時間・評価は DB に保存しない。
- 外部 API の失敗は必ず画面に出す（トースト、またはインラインのエラー表示）。黙って 0 件にしない。
- `proxy.ts` のマッチャーから `api/`・`_next/static`・`_next/image`・`favicon.ico`・`sw.js`・`manifest.webmanifest`・画像拡張子を除外する。
- UI の文言は日本語。選択入力はチップで行い、未選択は「不明」として保存する。ピンチズームを禁止しない（`userScalable` を設定しない）。
- Vercel の関数リージョンは `hnd1`。

## Review Focus

1. **大文字を含むユーザーID・登録済みのID** → 小文字に正規化して扱う。重複は「そのIDは使われています」と表示し、500 エラーにしない（Task 5 でテスト）。
2. **2 人がほぼ同時に同じ店（同じ place_id）を登録する** → 後の人は unique 制約違反になる。エラーではなく、既存の店の詳細ページへ移動させる（Task 8 でテスト）。
3. **写真の一部だけアップロードに失敗する／デコードできない形式（HEIC など）** → 記録本体は保存済みのまま、失敗した写真だけにエラーと再送ボタンを出す（Task 10 でテスト）。
4. **作り直して無効になった招待リンク・すでに参加済みの人が開くリンク** → 古いトークンは「この招待リンクは無効です」と表示する。参加済みの人はエラーにせず、そのリストへ移動させる（Task 13 でテスト）。
5. **論理削除された店が入っているリスト・共有リスト** → その店はリスト表示と件数から除外し、画面が落ちない（Task 3 の DB テストと Task 12 でテスト）。

---

## File Structure

```
supabase/
  config.toml                         # enable_signup=false、storage バケット
  migrations/0001_core.sql            # profiles, shops, visits, photos, app_settings, signup_attempts, is_admin()
  migrations/0002_lists.sql           # lists, list_items, shared_lists, shared_list_members, shared_list_items, 関数
  migrations/0003_views.sql           # shop_index, public_lists
  migrations/0004_storage.sql         # photos バケットと storage.objects のポリシー
  seed.sql                            # ローカル用のサンプル店
scripts/set-passphrase.ts             # 合言葉の初期設定（secret キー使用）
src/
  proxy.ts
  lib/options.ts                      # 全選択肢の定義（値とラベル）
  lib/validation.ts                   # zod スキーマ（ショップ、記録、サインアップ）
  lib/auth/login-id.ts                # normalizeLoginId, isValidLoginId, toAuthEmail
  lib/auth/passphrase.ts              # hashPassphrase, verifyPassphrase
  lib/supabase/server.ts | browser.ts | admin.ts
  lib/places/google.ts                # Places API (New) 呼び出し（サーバー専用）
  lib/images/resize.ts                # computeTargetSize, resizeToJpeg
  lib/visits/summarize.ts             # summarizeVisits（詳細ページの内訳）
  lib/filters/shop-filters.ts         # nuqs パーサーとクエリ適用
  lib/nav/use-back-or-home.ts
  app/(auth)/login/ signup/           # 画面と actions.ts
  app/(app)/layout.tsx                # 下部タブ、トースト Provider
  app/(app)/map/ search/ new/ me/
  app/(app)/shops/[id]/               # 詳細、edit/、visits/new/
  app/(app)/visits/[id]/edit/
  app/(app)/lists/[id]/ shared/[id]/ invite/[token]/ users/[loginId]/ admin/
  app/api/places/autocomplete|details|website/route.ts
  app/api/cron/refresh-locations/route.ts
  app/manifest.ts, app/error.tsx
  components/                         # bottom-nav, chip-group, shop-card, list-picker-sheet, photo-uploader, toast, confirm-dialog, shop-map
public/sw.js, public/icon.svg, public/apple-touch-icon.png
tests/unit/**  tests/db/**  tests/e2e/**
.github/workflows/ci.yml, daily.yml
```

---

### Task 1: プロジェクトの雛形・CI

**Files:**
- Create: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `vercel.json`, `.gitignore`, `.env.example`, `.github/workflows/ci.yml`, `src/app/layout.tsx`, `src/app/page.tsx`, `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: npm スクリプト `dev`, `build`, `lint`（`eslint .`）, `typecheck`（`tsc --noEmit`）, `test`（Vitest の unit プロジェクト）, `test:db`（Vitest の db プロジェクト。`supabase start` 済みが前提）, `test:e2e`（Playwright）

- [ ] **Step 1:** `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` を実行する。Next 16 系・Tailwind v4 であることを `package.json` で確認する。
- [ ] **Step 2:** 依存を追加する: `@supabase/ssr @supabase/supabase-js @vis.gl/react-google-maps nuqs zod`、dev 側は `vitest @vitejs/plugin-react jsdom @playwright/test supabase tsx`。
- [ ] **Step 3:** `vitest.config.ts` に 2 つのプロジェクトを定義する。`unit` は `tests/unit/**`（jsdom）、`db` は `tests/db/**`（node、`fileParallelism: false`）。
- [ ] **Step 4:** `tests/unit/smoke.test.ts` に `expect(1 + 1).toBe(2)` を書き、`npm test` が PASS することを確認する。
- [ ] **Step 5:** `.gitignore` に `.env*.local`, `test-results/`, `playwright/.auth/` を追加する。`.env.example` に Global Constraints の環境変数名を値なしで並べる。`vercel.json` に `{"regions":["hnd1"]}` を書く。
- [ ] **Step 6:** `ci.yml` を作る。push と PR で、`npm ci` → `lint` → `typecheck` → `test` → `build` を実行する。`db` ジョブは `supabase/setup-cli` → `supabase start` → `npm run test:db` を実行する（Task 3 以降で中身が入る）。
- [ ] **Step 7:** `npm run lint && npm run typecheck && npm test && npm run build` がすべて成功することを確認する。
- [ ] **Step 8:** Commit `chore: Next.js 16 の雛形とCIを追加`

---

### Task 2: 選択肢の定義と入力スキーマ

**Files:**
- Create: `src/lib/options.ts`, `src/lib/validation.ts`, `src/lib/visits/summarize.ts`
- Test: `tests/unit/options.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/summarize.test.ts`

**Interfaces:**
- Produces:
  - `type Option<V extends string> = { value: V; label: string }`
  - 選択肢の定数（値の並びと日本語ラベルは spec §3.5・§5.1 のとおり）:
    - `SMOKING`: `smoking_ok` 喫煙可 / `separated` 分煙・喫煙室あり / `heated_only` 加熱式のみ / `no_smoking` 禁煙 / `unknown` 不明
    - `PRICE_RANGES`: `under_3000` 〜2,999 / `3000_4999` / `5000_6999` / `7000_9999` / `over_10000` 10,000〜 / `unknown`
    - `PURPOSES`: `team_meeting` チーム会議 / `all_hands` 社員総会 / `celebration` 打ち上げ / `welcome_farewell` 歓送迎会 / `peers_only` 同期のみ / `entertainment` 接待 / `private` プライベート / `other` その他 / `unknown` 不明
    - `RESERVATIONS`: `reserved` 予約した / `walk_in` 予約なしで入れた / `unknown`
    - `PAYMENT_METHODS`: `credit_card` クレジットカード / `qr` QR決済 / `transit_ic` 交通系IC / `cash_only` 現金のみ（未選択＝不明。`unknown` 値は持たない）
    - `PHOTO_KINDS`: `menu` メニュー / `seat` 席 / `food` 料理 / `exterior` 外観 / `other` その他
    - `GENRES`: `washoku` 和食 / `sushi_seafood` 寿司・海鮮 / `yakiniku` 焼肉・ホルモン / `yakitori` 焼き鳥・串 / `nabe` 鍋 / `chinese` 中華 / `korean` 韓国 / `asian_ethnic` アジア・エスニック / `italian` イタリアン / `french_bistro` フレンチ・ビストロ / `yoshoku` 洋食 / `ramen` ラーメン / `curry` カレー / `cafe` カフェ / `other` その他 / `unknown` 不明
    - `STYLES`: `taishu_izakaya` 大衆居酒屋 / `izakaya` 居酒屋 / `dining_bar` ダイニングバー / `bar` バー / `tachinomi` 立ち飲み / `private_room` 個室あり / `karaoke` カラオケ / `other` その他
    - `LIST_KINDS`: `want` 気になる / `favorite` お気に入り
  - `labelOf(options, value): string`
  - `shopInputSchema`（`name` 1〜100 文字必須、`genre` 既定 `unknown`、`styles` 既定 `[]`、`referenceUrl` は http(s) の URL か空）
  - `visitInputSchema`（`visitedOn` は ISO 日付、`partySize` は 1〜500 の整数か null、`comment` は 1,000 文字まで、選択項目の既定は `unknown`、`paymentMethods` の既定は `[]`）
  - `signupInputSchema`（loginId・nickname・password・passphrase。Global Constraints の制約どおり）
  - `summarizeVisits(visits: VisitLike[]): VisitBreakdown` — 項目ごとに `{ value, count }[]` を件数の多い順に返す（`unknown` は除外）。`maxPartySize: number | null` も返す。

- [ ] **Step 1: 失敗するテストを書く**
  - `options.test.ts`: 各定数の value が重複していない。`labelOf(SMOKING, 'heated_only') === '加熱式のみ'`。
  - `validation.test.ts`:
    - `visitInputSchema.parse({ visitedOn: '2026-10-31' })` の `smoking`・`priceRange`・`purpose`・`reservation` がすべて `'unknown'`。
    - コメント 1,001 文字は失敗する。`partySize: 0` は失敗する。
    - `shopInputSchema` で `referenceUrl: 'javascript:alert(1)'` は失敗する。
  - `summarize.test.ts`: purpose が `celebration`×2・`team_meeting`×1・`unknown`×1 なら `[{value:'celebration',count:2},{value:'team_meeting',count:1}]`。`maxPartySize` は partySize の最大値。全件 null なら `null`。
- [ ] **Step 2:** `npm test` を実行し、FAIL（モジュールが存在しない）を確認する。
- [ ] **Step 3:** 上記 3 ファイルを実装する。
- [ ] **Step 4:** `npm test` を実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: 選択肢定義と入力スキーマを追加`

---

### Task 3: DB スキーマ・RLS・ビュー・Storage

**Files:**
- Create: `supabase/config.toml`（`supabase init` で作り、編集する）, `supabase/migrations/0001_core.sql`〜`0004_storage.sql`, `supabase/seed.sql`
- Test: `tests/db/helpers.ts`, `tests/db/core-rls.test.ts`, `tests/db/lists-rls.test.ts`, `tests/db/views.test.ts`, `tests/db/storage.test.ts`

**Interfaces:**
- Produces:
  - テーブルと列は spec §5.1 のとおり。外部キーの挙動:
    - `profiles.id` → auth.users は `on delete cascade`。
    - `visits.user_id`・`photos.user_id`・`shops.created_by`・`shared_list_items.added_by` は NULL 可で `on delete set null`（退会ユーザーの投稿は「退会したユーザー」として残す）。
    - `lists`・`list_items`・`shared_list_members` は削除をカスケードする。
  - `visits.shop_id`・`visits.user_id`・`photos.visit_id`・`list_items.list_id`・`shared_list_members.user_id` にインデックス。
  - 関数（すべて `security definer`、`set search_path = ''`）:
    - `public.is_admin() returns boolean`
    - `public.is_shared_list_member(p_list uuid) returns boolean`
    - `public.is_shared_list_owner(p_list uuid) returns boolean`
    - `public.join_shared_list(p_token text) returns uuid` — トークンが一致するリストに `member` として参加し、そのリストの id を返す。すでに参加済みなら何もせず id を返す。一致しなければ例外 `invalid_invite`。
    - `public.regenerate_invite_token(p_list uuid) returns text` — オーナーのみ実行できる。新しいトークンは `encode(gen_random_bytes(16),'hex')`。
  - トリガー: `shared_lists` の insert 後に、作成者を `owner` としてメンバーに追加する。
  - ビュー `public.shop_index`（`security_invoker = true`）: `shops` の全列＋ `visit_count`, `last_visited_on`, `smoking`（`unknown` 以外で最も新しい記録。`visited_on desc, created_at desc` 順）, `price_range`（`unknown` 以外の最頻値。同数なら新しい方）, `purposes text[]`（`unknown` 以外の重複なし）, `max_party_size`。記録がない、または代表値がない場合は `smoking`・`price_range` を `'unknown'` とする。削除済みの店と削除済みの記録は除く。
  - ビュー `public.public_lists`（`security_invoker = true`）: `kind ('personal'|'shared')`, `id`, `name`, `list_kind ('want'|'favorite'|null)`, `owner_id`, `owner_nickname`, `shop_count`（削除済みの店を除く）, `updated_at`（リストと項目の更新日時の新しい方）。`is_public = true` のものだけ。
  - 列単位の権限: `revoke update on shops from authenticated; grant update (name, genre, styles, reference_url, updated_at) on shops to authenticated;`。店の論理削除は管理者用 RPC `public.soft_delete_shop(p_shop uuid)` で行う。
  - `tests/db/helpers.ts`: `createTestUser(loginId: string, opts?: { admin?: boolean }): Promise<{ id: string; client: SupabaseClient }>` — secret キーで作成し、パスワードでログインしたクライアントを返す。`adminClient(): SupabaseClient`。

- [ ] **Step 1:** `supabase init` を実行する。`config.toml` で `[auth] enable_signup = false` にし、`[storage]` に非公開バケット `photos` を定義する。
- [ ] **Step 2: 失敗するテストを書く**（RLS のテストは、ユーザー A・B・管理者 C の 3 人で行う）
  - `core-rls.test.ts`:
    - ログインしていないクライアントで `shops` を select すると 0 件。
    - B は A の visit を update / delete できない（影響行数 0）。管理者 C は A の visit に `deleted_at` を設定できる。
    - A は shop の `name` を更新できるが、`deleted_at` と `place_id` は更新できない（権限エラー）。
    - 同じ `place_id` で 2 回 insert すると、2 回目はコード `23505` で失敗する。
    - `app_settings` は A からは select で 0 件、insert は失敗する。
    - 公開サインアップ（publishable キーでの `auth.signUp`）は失敗する。
    - `{loginId}@users.pe-shoplog.invalid` での `admin.createUser` は成功する。**このアドレスが拒否された場合は、`AUTH_EMAIL_DOMAIN` を `users.pe-shoplog.local` に変更し、Global Constraints と spec §4.2 も同じ値に直す。**
  - `lists-rls.test.ts`:
    - B は A の非公開リストと、その list_items を見られない。A の公開リストは見られる。
    - 共有リスト: A が作成すると A は owner になる。B は `join_shared_list(token)` で参加できる。もう一度呼んでもエラーにならず、同じ id が返る。
    - 参加前の B は items を insert できない。参加後はできる。
    - 古いトークン（`regenerate_invite_token` の後）での参加は `invalid_invite` で失敗する。
    - B はリスト本体を update できない。owner の A はできる。A は B をメンバーから外せる。B は自分で抜けられる。
  - `views.test.ts`:
    - visits（日付の古い順）の smoking が `smoking_ok`・`no_smoking`・`unknown` なら `shop_index.smoking = 'no_smoking'`。
    - price_range が `5000_6999`×2・`3000_4999`×1 なら `'5000_6999'`。1 件ずつで同数なら新しい方。
    - 記録のない店は `visit_count = 0`、`smoking = 'unknown'`。
    - 論理削除した店は `shop_index` に出ない。その店が入った公開リストの `public_lists.shop_count` からも除外される。
  - `storage.test.ts`:
    - A は自分の visit のパス `shops/{s}/visits/{v}/x.jpg` にアップロードできる。B の visit のパスにはアップロードできない。
    - ログインしていないクライアントは `createSignedUrl` に失敗する。
- [ ] **Step 3:** `supabase start && npm run test:db` を実行し、FAIL を確認する。
- [ ] **Step 4:** マイグレーション 4 本を実装する。RLS ポリシーは spec §5.2 の表のとおり。storage の insert 条件は `bucket_id = 'photos' and exists (select 1 from public.visits v where v.id = ((storage.foldername(name))[4])::uuid and v.user_id = (select auth.uid()))` とする。`seed.sql` にはサンプル店を 3 件入れる。
- [ ] **Step 5:** `supabase db reset && npm run test:db` を実行し、PASS を確認する。
- [ ] **Step 6:** Commit `feat: DBスキーマ・RLS・集計ビューを追加`

---

### Task 4: Supabase クライアント・proxy・認証ユーティリティ

**Files:**
- Create: `src/lib/supabase/server.ts`, `browser.ts`, `admin.ts`, `src/lib/auth/login-id.ts`, `src/lib/auth/passphrase.ts`, `src/lib/auth/current-user.ts`, `src/proxy.ts`
- Test: `tests/unit/login-id.test.ts`, `tests/unit/passphrase.test.ts`, `tests/unit/proxy-matcher.test.ts`

**Interfaces:**
- Produces:
  - `createServerClient(): Promise<SupabaseClient>`（server.ts）、`createBrowserClient(): SupabaseClient`（browser.ts）、`createAdminClient(): SupabaseClient`（admin.ts。先頭に `import "server-only"`）
  - `normalizeLoginId(s: string): string`（trim して小文字化）、`isValidLoginId(s: string): boolean`、`toAuthEmail(loginId: string): string`、`AUTH_EMAIL_DOMAIN`
  - `hashPassphrase(p: string): Promise<string>`（形式は `scrypt$<saltHex>$<hashHex>`）、`verifyPassphrase(input: string, stored: string): Promise<boolean>`。どちらも比較の前に trim と小文字化を行う。比較は `timingSafeEqual`。
  - `getCurrentUser(): Promise<{ id: string; loginId: string; nickname: string; isAdmin: boolean } | null>`、`requireUser()`（null なら `/login` へ redirect）、`requireAdmin()`（管理者でなければ `notFound()`）
  - `proxy.ts`: `getClaims()` で確認し、未ログインなら `/login?next=<元のパス>` へリダイレクトする。`/login` と `/signup` は通す。`config.matcher` は Global Constraints のとおり。

- [ ] **Step 1: 失敗するテストを書く**
  - `login-id.test.ts`: `normalizeLoginId(' Taro_1 ') === 'taro_1'`、`isValidLoginId('ab') === false`、`isValidLoginId('a'.repeat(21)) === false`、`isValidLoginId('taro-1') === false`、`toAuthEmail('taro') === 'taro@users.pe-shoplog.invalid'`。
  - `passphrase.test.ts`: `verifyPassphrase(' pe ', await hashPassphrase('PE')) === true`、`verifyPassphrase('PX', …) === false`。同じ入力でもハッシュは毎回異なる。
  - `proxy-matcher.test.ts`: matcher の正規表現（`src/proxy.ts` から `PROXY_MATCHER` として export する）が `/sw.js`・`/manifest.webmanifest`・`/api/places/details`・`/icon.svg` に一致せず、`/`・`/shops/abc` には一致する。
- [ ] **Step 2:** `npm test` を実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。scrypt は `node:crypto` の `scrypt`（keylen 32、salt 16 バイト）を使う。
- [ ] **Step 4:** `npm test` を実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: Supabaseクライアントとproxy・認証ユーティリティを追加`

---

### Task 5: 新規登録・ログイン・ログアウト

**Files:**
- Create: `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/signup/actions.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`, `src/lib/auth/signup.ts`, `scripts/set-passphrase.ts`
- Test: `tests/db/signup.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: Task 2 の `signupInputSchema`、Task 4 のユーティリティ一式
- Produces:
  - `registerUser(input: SignupInput, ip: string): Promise<{ ok: true; userId: string } | { ok: false; error: 'rate_limited' | 'bad_passphrase' | 'login_id_taken' | 'invalid' }>`（signup.ts）
    - 処理順: 試行記録の追加と 1 時間あたり件数の確認 → 合言葉の照合（`app_settings.key = 'signup_passphrase_hash'`）→ `admin.createUser({ email, password, email_confirm: true })` → `profiles` の insert → 既定のリスト「気になる」（want）・「お気に入り」（favorite）を、非公開・`is_default = true` で作る。
    - `createUser` でメール重複が返った場合は `login_id_taken`。
    - profiles の insert に失敗したら、作った auth ユーザーを削除してから失敗を返す。
  - `signupAction` / `loginAction` / `logoutAction`（`useActionState` 用。成功したら `next`、なければ `/map` へ redirect）
  - エラーメッセージ:
    - rate_limited:「試行回数が多すぎます。しばらくしてからお試しください」
    - bad_passphrase:「合言葉が違います」
    - login_id_taken:「そのIDは使われています」
    - ログイン失敗:「IDかパスワードが違います」
  - サインアップ画面の合言葉欄のラベルは「合言葉」、補足文は「いつもの2文字を入れてね」。
  - `npm run set-passphrase -- <合言葉>`: `app_settings` にハッシュを upsert する。

- [ ] **Step 1: 失敗するテストを書く**（`signup.test.ts`。ローカル DB で `registerUser` を直接呼ぶ）
  - 正しい合言葉 `pe` で成功する。profiles が作られ、lists が 2 件（want・favorite、非公開）作られる。
  - loginId `Taro` で登録した後に `taro` で登録すると `login_id_taken` になる。
  - 合言葉が違えば `bad_passphrase` になり、auth ユーザーは作られない。
  - 同じ IP から 11 回目は `rate_limited` になる。
- [ ] **Step 2:** `npm run test:db` を実行し、FAIL を確認する。
- [ ] **Step 3:** `signup.ts`・Server Actions・画面 2 つ・スクリプトを実装する。IP は `headers()` の `x-forwarded-for` の先頭の値を使う。
- [ ] **Step 4:** `npm run test:db` を実行し、PASS を確認する。
- [ ] **Step 5:** `tests/e2e/auth.spec.ts`: 新規登録 → `/map` に到達する → ログアウト → ログイン → `/map`。合言葉を間違えると「合言葉が違います」が表示される。あわせて Playwright の setup プロジェクトで、ログイン状態を `playwright/.auth/user.json` に保存する。
- [ ] **Step 6:** `npm run test:e2e -- auth` を実行し、PASS を確認する。
- [ ] **Step 7:** Commit `feat: ID・合言葉による新規登録とログインを追加`

---

### Task 6: Google Places の Route Handler

**Files:**
- Create: `src/lib/places/google.ts`, `src/app/api/places/autocomplete/route.ts`, `src/app/api/places/details/route.ts`, `src/app/api/places/website/route.ts`
- Test: `tests/unit/places.test.ts`

**Interfaces:**
- Produces（google.ts。先頭に `import "server-only"`）:
  - `autocomplete(input: string, sessionToken: string, bias?: { lat: number; lng: number }): Promise<{ placeId: string; mainText: string; secondaryText: string }[]>`
    - `POST https://places.googleapis.com/v1/places:autocomplete`、`languageCode: 'ja'`、`regionCode: 'jp'`、`includedPrimaryTypes: ['restaurant','bar','cafe']`、bias があれば半径 5000m の circle。
  - `getPlaceBasics(placeId: string, sessionToken?: string): Promise<{ placeId: string; name: string; lat: number; lng: number }>` — FieldMask `id,displayName,location`
  - `getPlaceLocation(placeId: string): Promise<{ lat: number; lng: number }>` — FieldMask `location`
  - `getPlaceWebsite(placeId: string): Promise<string | null>` — FieldMask `websiteUri`
  - Google が 2xx 以外を返したら `PlacesError(status, message)` を throw する。
  - Route Handler はすべて先に `getClaims()` を確認し、未ログインなら 401 を返す。`PlacesError` は `{ error: 'places_unavailable' }` と 502 で返す。
    - `GET /api/places/autocomplete?q=&session=&lat=&lng=`
    - `GET /api/places/details?id=&session=`
    - `GET /api/places/website?id=`
- [ ] **Step 1: 失敗するテストを書く**（`places.test.ts`。`fetch` を `vi.fn` で差し替える）
  - `getPlaceBasics` が、ヘッダー `X-Goog-FieldMask: id,displayName,location` と `X-Goog-Api-Key` を付けて呼ぶ。
  - `getPlaceWebsite` の FieldMask が `websiteUri` だけ。`websiteUri` がなければ `null` を返す。
  - 403 の応答で `PlacesError` を throw し、その `status` が 403。
  - `autocomplete` の body に `includedPrimaryTypes` と `sessionToken` が入る。
- [ ] **Step 2:** `npm test` を実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** `npm test` を実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: Places API (New) のサーバー経由呼び出しを追加`

---

### Task 7: アプリの枠組み（下部タブ・PWA・共通部品）

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/bottom-nav.tsx`, `src/components/toast.tsx`, `src/components/confirm-dialog.tsx`, `src/components/chip-group.tsx`, `src/lib/nav/use-back-or-home.ts`, `src/app/error.tsx`, `src/app/manifest.ts`, `public/sw.js`, `src/components/sw-register.tsx`, `public/icon.svg`, `public/apple-touch-icon.png`
- Modify: `src/app/layout.tsx`（`NuqsAdapter` で包み、viewport を設定する）, `src/app/page.tsx`（`/map` へ redirect）
- Test: `tests/unit/chip-group.test.tsx`, `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Produces:
  - `<ChipGroup<V> options={Option<V>[]} value={V | V[]} onChange multiple? name />`
    - 単一選択: 選択中のチップをもう一度押すと解除され、`'unknown'` に戻る。
    - 複数選択: トグル。
    - フォーム送信用に hidden input を出す（name 属性付き）。
    - 単一選択の場合、`unknown` のチップは表示しない（未選択＝不明）。
  - `useToast(): { show(message: string, kind?: 'info' | 'error'): void }`
  - `useConfirm(): (message: string) => Promise<boolean>`
  - `useBackOrHome(): () => void`（プレイブック §3.5 の挙動）
  - 下部タブ: マップ `/map` / さがす `/search` / ＋登録 `/new` / マイページ `/me`
- [ ] **Step 1: 失敗するテストを書く**
  - `chip-group.test.tsx`: 単一選択で「禁煙」を押すと `onChange('no_smoking')`。もう一度押すと `onChange('unknown')`。`unknown` のチップは表示されない。複数選択で 2 つ押すと 2 要素の配列になる。
- [ ] **Step 2:** `npm test` を実行し、FAIL を確認する。
- [ ] **Step 3:** 共通部品・レイアウト・PWA ファイルを実装する。manifest は `display: 'standalone'`、アイコンは `purpose` が `any` と `maskable` の 2 つ。`sw.js` は fetch ハンドラ付きの最小構成にする。
- [ ] **Step 4:** `npm test` を実行し、PASS を確認する。
- [ ] **Step 5:** `pwa.spec.ts`: 未ログインで `/sw.js` と `/manifest.webmanifest` が 200 を返し、リダイレクトされない。
- [ ] **Step 6:** `npm run test:e2e -- pwa` を実行し、PASS を確認する。
- [ ] **Step 7:** Commit `feat: 下部タブ・PWA・共通UI部品を追加`

---

### Task 8: お店の登録（＋登録）

**Files:**
- Create: `src/app/(app)/new/page.tsx`, `src/app/(app)/new/place-search.tsx`, `src/app/(app)/new/location-picker.tsx`, `src/app/(app)/new/actions.ts`, `src/lib/shops/create-shop.ts`
- Test: `tests/db/create-shop.test.ts`, `tests/e2e/new-shop.spec.ts`

**Interfaces:**
- Consumes: Task 6 の `/api/places/*`、Task 2 の `shopInputSchema`
- Produces:
  - `createShop(supabase, input: ShopInput & { placeId: string | null; lat: number; lng: number }): Promise<{ shopId: string; existed: boolean }>`
    - place_id の重複（`23505`）は、既存の店の id を引いて `existed: true` で返す。
    - 新規の場合は `location_fetched_at = now()` にする（手入力の店では null）。
  - `createShopAction(prev, formData)` — `mode = 'want' | 'visit'`。
    - want: 自分の既定の「気になる」リストに入れて `/shops/{id}` へ移動する。
    - visit: `/shops/{id}/visits/new` へ移動する。
    - `existed` の場合は、トースト「すでに登録されています」を出して `/shops/{id}` へ移動する（URL クエリ `?notice=exists` で渡す）。
  - `/new?placeId=...` で開いた場合（マップからの導線）は、店を選んだ状態から始める。
  - 店の検索を始めるときに `crypto.randomUUID()` でセッショントークンを作り、details の取得までそのトークンを使う。
- [ ] **Step 1: 失敗するテストを書く**
  - `create-shop.test.ts`:
    - 同じ placeId で A と B が順に `createShop` を呼ぶと、B は `existed: true` になり、同じ shopId が返る（Review Focus 2）。
    - `placeId: null` なら 2 回とも新規作成になる。
  - `new-shop.spec.ts`（`/api/places/**` を `page.route` でモックする）: 「渋谷」と入力 → 候補を選ぶ → 店名が自動で入る → 編集する → 「気になるで登録」→ 詳細ページに店名が出る。マイページの「気になる」リストにも入っている。
- [ ] **Step 2:** 2 つのテストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。手入力の店はマップをタップして位置を決める（`location-picker.tsx`）。地図が読み込めない場合は、エラーを表示して登録ボタンを無効にする。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: お店の登録フローを追加`

---

### Task 9: 店の詳細ページと店情報の編集

**Files:**
- Create: `src/app/(app)/shops/[id]/page.tsx`, `src/app/(app)/shops/[id]/website-button.tsx`, `src/app/(app)/shops/[id]/photo-gallery.tsx`, `src/app/(app)/shops/[id]/edit/page.tsx`, `src/app/(app)/shops/[id]/edit/actions.ts`, `src/lib/shops/google-maps-url.ts`
- Test: `tests/unit/google-maps-url.test.ts`, `tests/e2e/shop-detail.spec.ts`

**Interfaces:**
- Consumes: `shop_index`、`summarizeVisits`、`/api/places/website`
- Produces:
  - `googleMapsUrl(shop: { name: string; lat: number; lng: number; placeId: string | null }): string`
    - placeId がある場合: `https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(name)>&query_place_id=<placeId>`
    - placeId がない場合: `query=<lat>,<lng>`
  - 詳細ページの表示内容は spec §3.4 のとおり。
    - 代表値（喫煙・値段感）は `shop_index` から、内訳は `summarizeVisits` から出す。
    - 写真は種類タブで切り替え、署名付き URL を `createSignedUrls` でまとめて発行する。
  - 「気になる」「お気に入り」「＋リストに追加」のボタンは、Task 12 の `<ListPickerSheet>` を開く。Task 12 より前は、ボタンだけを置いておく。
  - `WebsiteButton`: タップすると `/api/places/website` を呼び、URL があれば `window.open` で開く。null なら「サイト情報がありません」、失敗したら「サイト情報を取得できませんでした」をトーストで出す。placeId のない店では表示しない。
  - `updateShopAction`: name・genre・styles・referenceUrl だけを更新する。
- [ ] **Step 1: 失敗するテストを書く**
  - `google-maps-url.test.ts`: 上の 2 パターン。店名に `&` を含んでもエンコードされる。
  - `shop-detail.spec.ts`: seed の店を開く → 喫煙・値段感の代表値が表示される。website の API が 502 を返すようにモックし、「公式サイト」をタップするとエラーのトーストが出る。
- [ ] **Step 2:** テストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: 店の詳細ページと店情報の編集を追加`

---

### Task 10: 行った記録の入力と写真アップロード

**Files:**
- Create: `src/lib/images/resize.ts`, `src/components/photo-uploader.tsx`, `src/app/(app)/shops/[id]/visits/new/page.tsx`, `src/app/(app)/visits/[id]/edit/page.tsx`, `src/components/visit-form.tsx`, `src/lib/visits/actions.ts`
- Test: `tests/unit/resize.test.ts`, `tests/unit/photo-uploader.test.tsx`, `tests/e2e/visit.spec.ts`

**Interfaces:**
- Consumes: Task 2 の `visitInputSchema` と選択肢、Task 7 の `ChipGroup`
- Produces:
  - `computeTargetSize(w: number, h: number, maxEdge = 1600): { width: number; height: number }`
  - `resizeToJpeg(file: File, maxEdge = 1600, quality = 0.8): Promise<{ blob: Blob; width: number; height: number }>` — デコードできなければ `ImageDecodeError` を throw する。
  - `createVisitAction(shopId, formData) → { visitId }`、`updateVisitAction(visitId, formData)`、`deleteVisitAction(visitId)`（論理削除）
  - `addPhotoAction({ visitId, shopId, kind, storagePath, width, height })`、`deletePhotoAction(photoId)`
  - `<PhotoUploader visitId shopId />`:
    - 1 枚ずつ「縮小 → `photos` バケットへアップロード → `addPhotoAction`」を行う。
    - 写真ごとの状態は `queued | uploading | done | error`。
    - error の写真には「再送」ボタンを出す（デコード失敗の場合は「この画像は読み込めません」と表示し、再送ボタンは出さない）。
    - 10 枚を超える分は追加できない。
  - 記録の保存は 2 段階で行う。先に記録本体を保存し、その visitId を使って写真をアップロードする。全写真が `done` になったら店ページへ戻る。失敗が残っていても「写真をあきらめて戻る」を選べる。
- [ ] **Step 1: 失敗するテストを書く**
  - `resize.test.ts`: `computeTargetSize(4000, 3000)` → `{1600, 1200}`。`(1000, 800)` はそのまま。`(3000, 4000)` → `{1200, 1600}`。
  - `photo-uploader.test.tsx`（Storage のアップロードと `resizeToJpeg` をモックする）: 3 枚中 2 枚目のアップロードだけ失敗させると、1 枚目と 3 枚目が done、2 枚目が error で「再送」ボタンが出る。再送が成功すると done になる（Review Focus 3）。`ImageDecodeError` の写真には「この画像は読み込めません」と表示される。
  - `visit.spec.ts`: 何も選ばずに記録を保存すると、詳細ページの喫煙が「不明」のまま。「禁煙」と「打ち上げ」を選び、写真（fixture の jpg）1 枚を付けて保存すると、詳細ページに反映され、写真が表示される。本人には編集・削除ボタンが表示される。
- [ ] **Step 2:** テストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: 行った記録と写真アップロードを追加`

---

### Task 11: 絞り込み・さがす（お店タブ）・マップ

**Files:**
- Create: `src/lib/filters/shop-filters.ts`, `src/components/shop-filter-sheet.tsx`, `src/components/shop-card.tsx`, `src/components/shop-map.tsx`, `src/app/(app)/search/page.tsx`, `src/app/(app)/map/page.tsx`
- Test: `tests/unit/shop-filters.test.ts`, `tests/db/shop-filters.test.ts`

**Interfaces:**
- Produces:
  - `shopFilterParsers`（nuqs）: `q: string`, `genre: string[]`, `styles: string[]`, `smoking: string[]`, `price: string[]`, `purpose: string[]`, `want: boolean`, `sort: 'new' | 'visits'`（既定 `new`）
  - `applyShopFilters(query, filters: ShopFilters)` — `shop_index` に対するクエリへ条件を加える。
    - q → `name ilike %q%`（`%` と `_` はエスケープする）
    - genre → `in`、styles → `overlaps`、smoking → `in`、price → `in`
    - purpose → `purposes overlaps`
    - want → `visit_count = 0`
    - sort: new は `created_at desc`、visits は `visit_count desc`
  - `<ShopMap shops onSelectShop onSelectPlace />`
    - `@vis.gl/react-google-maps` の `Map`（mapId 必須、`clickableIcons`）と `AdvancedMarker` を使う。
    - Google の店舗アイコンをタップすると、`event.detail.placeId` を `onSelectPlace` に渡す。その placeId が登録済みなら店カード、未登録なら「この店を登録」カード（`/new?placeId=` へのリンク）を出す。
    - 地図の読み込みに失敗したら、地図の領域に「地図を読み込めませんでした」と表示する。
  - 店カードの表示: 店名、ジャンル、喫煙・値段感の代表値、記録件数、「気になる（未訪問）」バッジ。
- [ ] **Step 1: 失敗するテストを書く**
  - `shop-filters.test.ts`: `q = '100%'` のとき、`ilike` の値が `%100\%%` になる（クエリビルダーをモックして呼び出し引数を確認する）。
  - `shop-filters.test.ts`（db）: seed の 3 店に対し、`smoking: ['no_smoking']` で 1 件、`want: true` で記録 0 件の店だけ、`purpose: ['celebration']` で該当店だけが返る。
- [ ] **Step 2:** テストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。マップは全店（絞り込み後）を一度に読み込む。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: 絞り込み・さがす・マップ画面を追加`

---

### Task 12: マイリスト（気になる／お気に入り）とマイページ

**Files:**
- Create: `src/components/list-picker-sheet.tsx`, `src/lib/lists/actions.ts`, `src/app/(app)/me/page.tsx`, `src/app/(app)/lists/[id]/page.tsx`, `src/app/(app)/users/[loginId]/page.tsx`
- Modify: `src/app/(app)/shops/[id]/page.tsx`（ボタンを `ListPickerSheet` につなぐ）
- Test: `tests/e2e/lists.spec.ts`

**Interfaces:**
- Produces:
  - `setListItemAction(listId, shopId, included: boolean)`、`createListAction({ name, kind, isPublic })`、`updateListAction(listId, { name?, isPublic? })`、`deleteListAction(listId)`（既定のリストは削除できない）
  - `<ListPickerSheet shopId mode: 'want' | 'favorite' | 'any' />`
    - want / favorite: その種類の自分のリストをチェックボックスで並べる。既定のリストを一番上に置く。開いた時点ではチェックを変えない（既に入っているリストにチェックが付いた状態で開く）。
    - any: 自分の全リストと参加中の共有リスト（Task 13 の `setSharedListItemAction` を使う）。
    - その場で「＋新しいリスト」を作れる。
  - 「気になる」「お気に入り」ボタン自体の表示は、どこかの同種リストに入っていれば塗りつぶしにする。
  - `/me`: タブは「マイリスト」「共有リスト」（Task 13）「自分の記録」「アカウント」。アカウントタブでは、ニックネームの変更、パスワードの変更（`auth.updateUser`）、ログアウトができる。
  - `/lists/[id]`: リスト名、持ち主、店カードの一覧（削除済みの店は除く）。持ち主には編集メニューを出す。
  - `/users/[loginId]`: その人の公開リストと記録の一覧。
- [ ] **Step 1: 失敗するテストを書く**（`lists.spec.ts`）
  - A が「お気に入り」から新しいリスト「2次会向き」（公開）を作り、店を追加する。
  - B は `/users/a` でそのリストを見られる。A の既定の非公開「気になる」リストは見えない。
  - 管理者がその店を論理削除すると、`/lists/[id]` の件数が減り、画面はエラーにならない（Review Focus 5）。
- [ ] **Step 2:** テストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: マイリストとマイページを追加`

---

### Task 13: 共有リスト

**Files:**
- Create: `src/lib/shared-lists/actions.ts`, `src/app/(app)/shared/[id]/page.tsx`, `src/app/(app)/invite/[token]/page.tsx`, `src/components/shared-list-tab.tsx`
- Modify: `src/app/(app)/me/page.tsx`, `src/components/list-picker-sheet.tsx`
- Test: `tests/e2e/shared-lists.spec.ts`

**Interfaces:**
- Consumes: Task 3 の `join_shared_list`、`regenerate_invite_token`
- Produces:
  - `createSharedListAction({ name, description, isPublic }) → { id }`
  - `setSharedListItemAction(listId, shopId, included: boolean, note?: string)`
  - `updateSharedListAction`、`deleteSharedListAction`（オーナーのみ）
  - `removeMemberAction(listId, userId)`（オーナー、または本人が抜ける場合）
  - `regenerateInviteAction(listId) → { token }`
  - 招待 URL は `${origin}/invite/${token}`。「リンクをコピー」ボタンで `navigator.clipboard` にコピーする。
  - `/invite/[token]`: リスト名とオーナーを表示し、「参加する」ボタンを押すと `join_shared_list` を呼んで `/shared/{id}` へ移動する。
    - すでにメンバーなら、ボタンは出さずに `/shared/{id}` へ redirect する。
    - `invalid_invite` の場合は「この招待リンクは無効です」と表示する。
    - 未ログインなら、proxy でログイン画面へ送り、ログイン後にこのページへ戻す。
  - `/shared/[id]`: 店カードと、追加した人・メモの一覧、メンバー一覧。オーナーには、メンバーを外す・リンクを作り直す・設定変更・削除のメニューを出す。
- [ ] **Step 1: 失敗するテストを書く**（`shared-lists.spec.ts`）
  - A が共有リストを作り、招待リンクを取得する。
  - B がリンクを開いて参加し、メモ付きで店を追加する。A のページにその店と B のニックネームが出る。
  - B がもう一度同じリンクを開くと、そのまま `/shared/{id}` へ移動する（Review Focus 4）。
  - A がリンクを作り直すと、C が古いリンクを開いたとき「この招待リンクは無効です」と表示される（Review Focus 4）。
- [ ] **Step 2:** テストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: 共有リストと招待リンクを追加`

---

### Task 14: さがす（リストタブ）

**Files:**
- Create: `src/components/list-card.tsx`
- Modify: `src/app/(app)/search/page.tsx`（タブ切り替え。`tab` を nuqs で URL に持つ）
- Test: `tests/db/public-lists.test.ts`

**Interfaces:**
- Consumes: `public_lists` ビュー
- Produces:
  - リストタブ: `public_lists` を `sort = 'updated' | 'count'` で並べる。名前で検索できる（`q`）。
  - カードには、マイリストか共有リストかのバッジ、種類、持ち主、店の数を表示する。
  - カードをタップすると、`kind` に応じて `/lists/{id}` か `/shared/{id}` へ移動する。
- [ ] **Step 1: 失敗するテストを書く**（`public-lists.test.ts`）
  - B から見て、A の公開マイリストと公開共有リストは出る。非公開のものは出ない。
  - `shop_count` の多い順に並べ替えると、件数の降順になる。
- [ ] **Step 2:** テストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: 公開リストの検索を追加`

---

### Task 15: 管理画面

**Files:**
- Create: `src/app/(app)/admin/page.tsx`, `src/app/(app)/admin/actions.ts`, `src/lib/admin/temp-password.ts`
- Modify: 店の詳細ページ・記録・写真に、管理者だけに見える削除メニューを追加する
- Test: `tests/unit/temp-password.test.ts`, `tests/db/admin.test.ts`

**Interfaces:**
- Consumes: Task 4 の `requireAdmin`、`createAdminClient`、`hashPassphrase`
- Produces:
  - `generateTempPassword(): string`（12 文字。紛らわしい `0O1lI` を除いた英数字。`crypto.getRandomValues` を使う）
  - Server Actions（各アクションの先頭で必ず `requireAdmin()` を呼ぶ）:
    - `setPassphraseAction(passphrase)`
    - `issueTempPasswordAction(userId) → { tempPassword }`（画面に 1 度だけ表示する）
    - `disableUserAction(userId)`（`disabled_at` を設定し、`ban_duration: '876000h'` で BAN する）
    - `enableUserAction(userId)`
    - `deleteUserAction(userId)`（`auth.admin.deleteUser`。投稿は「退会したユーザー」として残る）
    - `grantAdminAction(userId, on: boolean)`
    - `softDeleteShopAction`、`softDeleteVisitAction`、`deletePhotoAction`
  - `/admin`: ユーザー一覧（ログインID・ニックネーム・状態）と各操作、合言葉変更のフォーム。管理者以外が開くと 404。
- [ ] **Step 1: 失敗するテストを書く**
  - `temp-password.test.ts`: 長さが 12 で、`0O1lI` を含まない（100 回生成して確認する）。
  - `admin.test.ts`:
    - 管理者以外が `setPassphraseAction` 相当の処理を呼ぶと拒否される。
    - 停止したユーザーはパスワードでログインできない。
    - 削除したユーザーの visit は残り、`user_id` が null になる。
    - 合言葉を変更すると、古い合言葉での `registerUser` が `bad_passphrase` になる。
- [ ] **Step 2:** テストを実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。ニックネームの表示箇所では、`user_id` が null なら「退会したユーザー」と表示する。
- [ ] **Step 4:** テストを実行し、PASS を確認する。
- [ ] **Step 5:** Commit `feat: 管理画面を追加`

---

### Task 16: 日次バッチ（バックアップ・位置の更新）と README

**Files:**
- Create: `src/app/api/cron/refresh-locations/route.ts`, `src/lib/places/refresh-locations.ts`, `.github/workflows/daily.yml`, `README.md`
- Test: `tests/unit/refresh-locations.test.ts`

**Interfaces:**
- Consumes: Task 6 の `getPlaceLocation`、`createAdminClient`
- Produces:
  - `refreshStaleLocations(deps: { listStale(limit: number): Promise<{ id: string; placeId: string }[]>; fetchLocation(placeId: string): Promise<{ lat: number; lng: number }>; save(id: string, loc: { lat: number; lng: number }): Promise<void> }, limit = 200): Promise<{ updated: number; failed: number }>`
    - 1 件が失敗しても残りは続ける。
    - stale の条件は「`place_id is not null and deleted_at is null and location_fetched_at < now() - interval '25 days'`」。
  - `GET /api/cron/refresh-locations`: `Authorization: Bearer ${CRON_SECRET}` が一致しなければ 401。一致すれば結果を JSON で返す。
  - `daily.yml`（cron は毎日 1 回、JST の早朝。例: `17 19 * * *`。workflow_dispatch も可）:
    1. `supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql` と `--data-only -f data.sql` → `actions/upload-artifact`（`retention-days: 90`）
    2. `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/refresh-locations"`
    - 使うシークレット: `SUPABASE_DB_URL`、`CRON_SECRET`、`APP_URL`
  - README に書く手順:
    - Supabase プロジェクトの作成（東京リージョン、公開サインアップの無効化、マイグレーションの適用）
    - Google Cloud の設定（キー 2 本と制限、Map ID と飲食以外の POI を非表示にするスタイル、予算アラート、日次クォータ）
    - Vercel の環境変数、GitHub のシークレット
    - `npm run set-passphrase -- PE` の実行
    - 最初の管理者の設定（`update profiles set is_admin = true where login_id = '...'`）
    - ローカル開発（`supabase start` → `npm run dev`）とテストの実行方法
- [ ] **Step 1: 失敗するテストを書く**（`refresh-locations.test.ts`）
  - stale が 3 件で 2 件目の fetch が throw すると、`{ updated: 2, failed: 1 }` になり、save が 2 回呼ばれる。
- [ ] **Step 2:** `npm test` を実行し、FAIL を確認する。
- [ ] **Step 3:** 実装する。workflow と README も作る。
- [ ] **Step 4:** `npm test` を実行し PASS を確認し、`npm run lint && npm run typecheck && npm run build` も成功させる。
- [ ] **Step 5:** Commit `feat: 日次バックアップ・位置更新バッチとセットアップ手順を追加`

---

### Task 17: 主要フローの通し E2E と仕上げ確認

**Files:**
- Create: `tests/e2e/main-flow.spec.ts`
- Modify: `.github/workflows/ci.yml`（e2e ジョブを追加: `supabase start` → `npm run build && npm start` → `npm run test:e2e`）

- [ ] **Step 1:** `main-flow.spec.ts` を書く（Places はモックする）。
  - 新規登録 → 店を「気になる」で登録 → 別のユーザーで同じ店に記録（写真付き）を付ける → 店の状態が「訪問あり」に変わる → 公開リストに追加 → 共有リストへ招待・参加。
- [ ] **Step 2:** `npm run test:e2e` を実行し、全テストの PASS を確認する。
- [ ] **Step 3:** スマホ表示（Playwright の `iPhone 15` プロファイル）で、下部タブと記録フォームが画面幅に収まることをスクリーンショットで確認する。
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build` がすべて成功することを確認する。
- [ ] **Step 5:** Commit `test: 主要フローのE2EをCIに追加`
