# 引き継ぎ: 本番 Supabase（biz-works）のセットアップ

前のセッションで、アプリ本体（全17タスク + 最終レビュー修正）は完成し、ブランチ `claude/gifted-maxwell-pwpc2d` に push 済み。
このセッションでは **本番 Supabase プロジェクトのセットアップ** を行う。

## 前提
- ユーザーが Supabase ダッシュボードで新しいプロジェクト **`biz-works`**（東京リージョン）を作成済み。会社関係のアプリをまとめる汎用プロジェクトで、ショップログが最初のアプリ。
- 環境変数: `SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`（biz-works の DB パスワード。前のセッションの値から変更済み）。値は絶対に表示・コミットしない。
- ネットワーク: `api.supabase.com` と `*.supabase.co` は許可済み。
- 既存プロジェクト `porygon-works`（ref: ipwrkyjmvrmhwhurhuly）は **別アプリ（ggmg / roas スキーマ）が同居しているので一切触らない**。
- 前のセッションのアクセストークンでは organization 一覧が空で、プロジェクト作成が 403 だった。`biz-works` が `supabase projects list`（または `GET https://api.supabase.com/v1/projects`）に出てこない場合は、トークンの権限不足。ユーザーに「biz-works にアクセスできる（組織権限のある）アクセストークンを作り直して環境変数を差し替え、新しいセッションで再開」を依頼して止まる。

## 手順
1. `biz-works` の project ref を取得する。
2. マイグレーション適用: `npx supabase link --project-ref <ref>`（パスワードは `SUPABASE_DB_PASSWORD`）→ `npx supabase db push`。
   - DB への直接接続（5432/6543）がこのサンドボックスのプロキシで通らない場合は、Management API の `POST /v1/projects/<ref>/database/query` で `supabase/migrations/0001`〜`0006` を **番号順に1本ずつ** 実行する（HTTPS なので通る）。その場合は `supabase_migrations.schema_migrations` に記録されないことを README の運用欄にメモする。
   - 適用後、`public` のテーブル・ビュー・関数、`storage.buckets` に `photos` があることを確認する。
3. 認証設定: `supabase config push` は config.toml 全体（site_url=localhost 等）を本番に上書きするので **使わない**。Management API `PATCH /v1/projects/<ref>/config/auth` で必要な項目だけ設定する:
   - 公開サインアップ無効（`disable_signup: true`）
   - パスワード最小長 8（`password_min_length: 8`）
   - メール確認不要（ダミーアドレスなので。`mailer_autoconfirm: true`）
   - 設定後に GET で値を確認する。
4. API キー取得: `GET /v1/projects/<ref>/api-keys`（新形式の publishable / secret キー）。**値は表示しない**。ユーザーには「Vercel に入れる環境変数の名前と、ダッシュボードのどこで値を見られるか」だけを伝える。
5. 合言葉の初期設定: `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<取得したsecret> npm run set-passphrase -- <合言葉>`。合言葉は社内で使う「いつもの2文字」（ユーザーが前のセッションで指定済み: `PE`）。シェル履歴やログに secret を残さないよう、環境変数経由で渡す。
6. 動作確認（読み取り）: `app_settings` に `signup_passphrase_hash` が入ったこと、匿名キーで `auth/v1/signup` が `signup_disabled` になることを確認する。
7. 最初の管理者はユーザーがアプリで登録した後に設定する（README の SQL）。今回は手順だけ伝える。

## まだ決まっていないこと（ユーザーに確認）
- ブランチの扱い: リモートにはこのブランチしかなく `main` がない。(1) `main` を作ってマージ (2) 空の `main` を作って PR (3) このまま。
- Vercel / Google Cloud / GitHub Secrets の設定はユーザー作業（README 参照）。Vercel はトークンを環境変数に入れてもらえば CLI で代行可能。

## 注意
- 本番 DB に対する破壊的操作（drop / delete / reset）はしない。`supabase db reset --linked` は絶対に実行しない。
- このリポジトリの AGENTS.md と docs/superpowers 以下（spec・plan・判断記録）を参照のこと。
