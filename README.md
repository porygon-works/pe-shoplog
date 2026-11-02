# ぺーろぐ

社内メンバーが「行ったお店」を地図と一覧で記録・共有するための、非公式の社内ツールです。お店の登録、行った記録（喫煙・値段感・用途・支払い方法・コメント・写真）、マイリスト、共有リストが使えます。スマホで使う前提の PWA です。

- 利用者は社員のみ。ログイン必須で、登録には社内で共有している合言葉が必要です。
- 設計の詳細は `docs/superpowers/specs/2026-10-31-pe-shoplog-design.md` を参照してください。

## 技術構成

- Next.js 16（App Router、`src/proxy.ts`）/ React 19 / Tailwind CSS 4
- Supabase（Postgres・Auth・Storage）。新形式の publishable / secret キーを使う
- Google Maps Platform（Maps JavaScript API、Places API (New)）
- Vercel（Hobby、関数リージョン `hnd1`）
- GitHub Actions（CI と、毎日のバックアップ・位置情報の更新）
- テスト: Vitest（unit / db）、Playwright（e2e）

## ローカル開発

必要なもの: Node.js 20.9 以上、Docker（Supabase のローカル環境に使う）。

```bash
npm ci
npx supabase start    # 初回はイメージの取得に時間がかかる。CLI は devDependency
```

`.env.local` を作ります（`.env.example` に変数名の一覧があります）。ローカル用の値は `npx supabase status -o env` で確認できます。

```bash
cp .env.example .env.local
npx supabase status -o env
```

| 変数 | ローカルでの値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL`（通常 `http://127.0.0.1:54321`） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAP_ID` | Google Cloud で作ったもの（後述） |
| `GOOGLE_PLACES_API_KEY` | Google Cloud で作ったサーバー用キー（後述） |
| `CRON_SECRET` | 任意の長いランダム文字列（`openssl rand -hex 32` など） |

合言葉を設定してから起動します（これをしないと新規登録できません）。

```bash
npm run set-passphrase -- <合言葉>
npm run dev           # http://localhost:3000
```

`.env.local` はコミットしないでください（`.gitignore` 済み）。

## テスト

```bash
npm test              # unit（Vitest）。Supabase 不要
npm run test:db       # RLS などの DB テスト。`npx supabase start` が必要
npm run test:e2e      # Playwright。`npx supabase start` と .env.local が必要
npm run lint && npm run typecheck && npm run build
```

- e2e は Google API を Route Handler のモックで置き換えるので、Google のキーは使いません。
- サンドボックスなどで Playwright 同梱のブラウザを使えない場合は、`PW_CHROMIUM_PATH` に Chromium の実行ファイルのパスを指定します。

  ```bash
  PW_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
  ```

## 本番セットアップ手順

### 1. Supabase

1. このアプリ専用のプロジェクトを作ります。リージョンは **Tokyo (ap-northeast-1)**。
2. Authentication → Sign In / Providers（または Settings）で **公開サインアップを無効**にします（ローカルの `supabase/config.toml` では `[auth] enable_signup = false`）。登録は必ずアプリの Server Action（合言葉つき）を通ります。
3. Authentication → Sign In / Providers → Email（または Settings）で **最小パスワード長（Minimum password length）を 8** にします。アプリは 8 文字以上を前提にしており、Supabase の既定は 6 です。
4. マイグレーションを適用します。

   ```bash
   npx supabase login
   npx supabase link --project-ref <プロジェクトの ref>
   npx supabase db push
   ```

5. キーを控えます（Project Settings → API Keys）。
   - publishable キー → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - secret キー → `SUPABASE_SECRET_KEY`（サーバー専用。ブラウザに出さない）
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
6. DB の接続文字列（Connect → **Session pooler** の URI）を控えます。GitHub Actions のバックアップで使います（`SUPABASE_DB_URL`）。Free プランの直接接続は IPv6 のみで、GitHub のランナーからは繋がらないため、pooler を使います。

### 2. Google Cloud

1. プロジェクトを作り、課金を有効にします。**Maps JavaScript API** と **Places API (New)** を有効にします。
2. キーを 2 本作ります。
   - **ブラウザ用**: アプリケーションの制限は「HTTP リファラー」（本番のドメインと、必要ならプレビュー用ドメイン）。API の制限は **Maps JavaScript API だけ**。→ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **サーバー用**: API の制限は **Places API (New) だけ**。Vercel の関数は IP が固定されないため IP 制限は使わず、クォータで守ります。Vercel の環境変数にだけ置きます。→ `GOOGLE_PLACES_API_KEY`
3. **Map ID** を作ります（Google Maps Platform → Map Management）。マップの種類は JavaScript、ベクターを選びます。→ `NEXT_PUBLIC_GOOGLE_MAP_ID`
   - マーカーに AdvancedMarker を使うため、Map ID が必須です。
   - Map Styles（クラウドベースのスタイル）で、飲食店以外の POI（店舗・公共施設・宿泊施設など）を非表示にして Map ID に関連付けます。
4. **予算アラート**を設定します（Billing → Budgets & alerts）。
5. **API ごとの 1 日あたり上限**を設定します（APIs & Services → 各 API → Quotas & System Limits）。Places API (New) と Maps JavaScript API の両方に、想定利用量より少し多い程度の上限を入れてください。
6. 課金が止まると地図も検索も全て止まります。たまに課金状態も確認してください。

### 3. Vercel

- Hobby プランで運用します。Vercel Hobby は規約上「個人の非商用利用」限定です。小規模な非公式ツールとして始め、利用が広がったら Pro へ上げる前提で、リスクを承知の上で採用しています（設計書 §1.2）。
- GitHub リポジトリを連携し、main への push で本番に反映されます。
- 関数リージョンは `vercel.json` の `{"regions":["hnd1"]}` で東京に固定済みです。
- Environment Variables に次の 7 つを設定します。

  | 変数 | 備考 |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | |
  | `SUPABASE_SECRET_KEY` | サーバー専用 |
  | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ブラウザ用キー |
  | `NEXT_PUBLIC_GOOGLE_MAP_ID` | |
  | `GOOGLE_PLACES_API_KEY` | サーバー用キー |
  | `CRON_SECRET` | 日次バッチ用。GitHub のシークレットと同じ値 |

### 4. GitHub

- Settings → Secrets and variables → Actions に次を登録します（`.github/workflows/daily.yml` が使います）。

  | シークレット | 値 |
  |---|---|
  | `SUPABASE_DB_URL` | Supabase の Session pooler の接続 URI |
  | `CRON_SECRET` | Vercel と同じ値 |
  | `APP_URL` | 本番の URL（例 `https://xxxx.vercel.app`、末尾に `/` を付けない） |

- Settings → Code security で **Push protection** を有効にします。
- 登録後、Actions タブの「Daily」を `workflow_dispatch` で 1 回手動実行して、成功することを確認します。

### 5. 合言葉と最初の管理者

1. 本番の `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SECRET_KEY` を環境変数に入れた状態で、合言葉を設定します。合言葉は社内で共有しているものを使います（大文字・小文字は区別されません）。

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run set-passphrase -- <合言葉>
   ```

   シェルの履歴に残したくない場合は、本番用の値を入れた別の env ファイルを用意して読み込んでください。

2. アプリで自分のアカウントを新規登録します。
3. Supabase の SQL Editor で、自分を管理者にします。

   ```sql
   update profiles set is_admin = true where login_id = '<自分のユーザーID>';
   ```

   以降、管理者の追加は管理画面（`/admin`）からできます。

## 運用

### 本番の更新（デプロイ）

- 本番は `main` ブランチから Vercel にデプロイされます（URL: https://pe-shoplog.vercel.app 。デプロイしても変わりません）。
- 本番を更新するときは、作業ブランチの変更を `main` にマージします。`main` に入った時点で自動でデプロイされます。
- DB の変更（`supabase/migrations` の追加）を含む場合は、マージ前に本番 DB へ適用してください。

### 本番 DB のマイグレーション履歴（biz-works）

- 本番プロジェクト `biz-works`（ref: `jpwazqjrqtlbwfvagstx`、Tokyo）の初回セットアップ（2026-11-01）では、作業環境から DB に直接接続できなかったため、`0001`〜`0006` を Management API（`POST /v1/projects/<ref>/database/query`）で番号順に適用しました。2026-11-01 に `0007`（区分の管理）・`0008`（★評価・日付の任意化）、2026-11-02 に `0009`（昼／夜の時間帯）・`0010`（ログインの試行制限・API の使用回数の上限）、2026-11-03 に `0011`（ジャンルの複数選択）・`0012`（用途の選択肢）・`0013`（用途の区分管理）・`0014`（喫煙を店の項目に）も同じ方法で適用しています。
- そのため `supabase_migrations.schema_migrations` には記録がありません。次に `npx supabase db push` を使う前に、適用済みとして登録してください（DB には何も実行されず、履歴だけが入ります）。

  ```bash
  npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014
  ```

### ジャンル・形態の変更

- 店のジャンルと形態（居酒屋・バーなど）は、管理者が管理画面（`/admin` の「ジャンル・形態の編集」、`/admin/categories`）から変更できます。コードの変更やデプロイは要りません。
- 追加（表示名だけ入力）、表示名の変更、↑↓での並べ替え、表示 / 非表示の切り替えができます。使っている店の数も出ます。
- 削除はできません。使わない区分は「非表示」にすると、新しく選べなくなります。すでにその区分の店は、そのまま表示されます。
- 「不明」（ジャンル）は未選択時の既定値なので、非表示にできません。

### バックアップの取り出し方

- **このリポジトリは必ず private にしてください。** public リポジトリでは workflow の artifact を誰でもダウンロードでき、`data.sql` にはユーザー情報やコメントが含まれます。
- 毎日 04:17 JST ごろに、GitHub Actions（Daily）が `schema.sql`・`data.sql`・`auth_data.sql`（`auth` スキーマのデータ。`profiles` が `auth.users` を参照するため必要）を `db-backup-YYYY-MM-DD` という artifact に保存します（90 日間）。Supabase の Free プランには自動バックアップがありません。
- 取り出し: GitHub → Actions → Daily → 該当の実行 → Artifacts からダウンロード。
- 復元する場合は、空の Supabase プロジェクト（またはローカル）に `schema.sql` → `auth_data.sql` → `data.sql` の順で `psql` から流します。
- 写真ファイル（Storage）はバックアップに含まれません。
- 毎日 DB にアクセスするので、Free プランの「7 日間アクセスがないと一時停止」も避けられます。Daily が失敗し続けていないか、たまに Actions を見てください。

### 位置情報の更新

- Google の規約上、緯度経度は 30 日までしか保存できません。Daily が `/api/cron/refresh-locations` を呼び、`location_fetched_at` が 25 日より古い店（`place_id` あり・未削除）の位置を、1 回あたり最大 200 件まで取り直します。
- 手入力の店（`place_id` なし）は、ユーザーが指定した位置なので対象外です。
- 結果は JSON（`{"updated":N,"failed":M}`）で返ります。`failed` が続く場合は、Vercel のログと Google Cloud の課金状態・クォータを確認してください。
- 手動で動かすには、Actions の Daily を `workflow_dispatch` で実行します。

### 合言葉の変更

- 管理画面（`/admin`）の「合言葉の変更」から変更できます。コマンドで設定する場合は `npm run set-passphrase -- <新しい合言葉>`。
- 変更後は、新しい合言葉を社内に周知してください。既存ユーザーには影響しません。

### パスワードを忘れた人への対応

- メールでの再設定はできません。管理画面（`/admin`）から該当ユーザーに**仮パスワードを発行**し、本人に伝えます。本人はログイン後にパスワードを変更してください。

### ユーザーの停止

- 管理画面（`/admin`）から、ユーザーの停止・再開・削除ができます。停止したユーザーはログインできなくなります。
- 不適切なお店・記録・写真は、管理画面から削除（論理削除）できます。

## 注意事項

- **`x-forwarded-for` を信頼しています。** 新規登録の試行回数制限（同じ IP から 1 時間に 10 回まで）は、このヘッダで IP を判断しています。Vercel はこのヘッダを上書きするので問題ありませんが、他のホスティングに移す場合は、クライアントがヘッダを偽装できないかを必ず確認してください。
- **停止したユーザーの既存トークンは、最長 1 時間有効です。** 停止するとログインと更新はできなくなりますが、すでに発行されたアクセストークンは期限（最長 1 時間）まで使えます。
- 秘密情報（secret キー、`CRON_SECRET`、サーバー用の Google キー）はコミットしないでください。`.env.example` には変数名だけを書きます。
- PWA がインストールできない・起動しないときは、DevTools → Application → Manifest の Installability を最初に確認します。`sw.js` と `manifest.webmanifest` が `/login` にリダイレクトされていないか（`src/proxy.ts` のマッチャーから除外されているか）も確認してください。
