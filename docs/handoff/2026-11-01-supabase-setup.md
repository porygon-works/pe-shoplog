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

## 経過メモ（2026-11-01 3回目のセッション）
- 新しいアクセストークンは有効で、`GET /v1/projects` に `biz-works`（ref: nqidngciezguadreaoga）が見えた。
- ただしリージョンが **eu-west-1** だった（予定は東京 ap-northeast-1）。中身は空（public テーブル0・バケット0・ユーザー0）。
- ユーザー判断で「東京で作り直す」ことになったため、このセッションでは何も書き込まずに停止。
- 再開時: 作り直した biz-works の region が `ap-northeast-1` であることを `GET /v1/projects` で確認してから手順1へ。ref は変わるので上記 ref は使わない。DB パスワードを新しくした場合は環境変数 `SUPABASE_DB_PASSWORD` も差し替えて新しいセッションで開始する。

## 完了（2026-11-01 同セッション続き）
- 2回目の作成もリージョンが ap-southeast-2（シドニー）だったため、ユーザーが削除し、Management API で `region: ap-northeast-1` を指定して作り直した。DB パスワードは `SUPABASE_DB_PASSWORD` の値。
- 本番: `biz-works` ref **jpwazqjrqtlbwfvagstx**（ap-northeast-1）。
- `supabase db push` は pooler への接続がタイムアウトしたため、0001〜0006 を Management API で番号順に適用。schema_migrations 未記録（README「運用」に repair 手順を記載）。
- テーブル11・ビュー2・関数11・`photos` バケット（非公開）を確認。public の全テーブルで RLS 有効。
- 認証: disable_signup=true / password_min_length=8 / mailer_autoconfirm=true（GET で確認）。site_url は localhost:3000 のまま（Vercel の URL が決まったら設定）。
- 合言葉 `PE` を設定し、`app_settings.signup_passphrase_hash` を確認。publishable キーでの `auth/v1/signup` は `signup_disabled`（422）。
- 残り: Vercel 環境変数、最初の管理者、ブランチの扱い、Google Cloud / GitHub Secrets（README 参照）。
