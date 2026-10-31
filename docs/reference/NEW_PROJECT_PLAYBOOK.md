# 新規プロジェクト向けプレイブック — 社内グルメ（社員向け食べログ）

gyoza（餃子手帳）の開発・運用で得た知見を汎用化し、2026年10月時点の Web 調査で裏取りした「今ならこう作る」をまとめたもの。
新プロジェクトでは `UI_REFERENCE.md` / `CODING_STANDARDS.md` / `CI_CD_SETUP.md` と一緒に `docs/` へコピーして使う。

> 出典の信頼度: 公式ドキュメントで確認できたものは断定、第三者記事のみのものは「（要確認）」と明記している。

---

## 0. 最重要ポイント（先に読む10項目）

1. **ホスティングは Vercel Pro にする。** Hobby プランは個人の非商用利用限定で、社内業務ツールは商用扱いになる。
2. **Supabase の Free プランには自動バックアップがない。** 初日から `supabase db dump` を GitHub Actions で定期実行する（gyoza はこれがなく、shops テーブル消失時にユーザー追加分を復元できなかった）。
3. **Supabase プロジェクトを他アプリと相乗りしない。** どうしても共用するなら専用スキーマに分ける。
4. **Google Maps の「月$200無料クレジット」は2025年3月に廃止済み。** SKU ごとの無料枠に変わった。予算アラートと API ごとの日次クォータ上限を初日に設定する。
5. **Places API はサーバー経由で呼ぶ。** キーはサーバー用とブラウザ用に分け、サーバー用キーをバンドルに出さない（gyoza はブラウザに Places 用キーが露出している）。
6. **フィールドマスクで課金 SKU が決まる。** 取るフィールドは最小限にする。
7. **Next.js 16 では `middleware.ts` が `proxy.ts` に、`next lint` は廃止。** proxy の matcher から公開アセット（`sw.js`、`manifest.webmanifest`、`/api/*`）を必ず除外する。
8. **共有データ（お店）と個人データ（レビュー）はテーブルを分ける。** `place_id` はお店テーブルで一意にする。
9. **認証は社内 SSO（Google Workspace / Microsoft Entra ID）にし、Before User Created フックで会社ドメイン以外を拒否する。**
10. **外部 API の失敗は必ず画面に出す。** 無言の「0件」はユーザーにも開発者にも原因が見えない。

---

## 1. gyoza で確立した再利用資産

### 1.1 技術スタック（実績あり）

| 層 | gyoza での採用 | 新規なら |
|---|---|---|
| フレームワーク | Next.js 14 App Router | **Next.js 16**（§3.1） |
| DB / 認証 / ストレージ | Supabase（RLS、Storage） | 同じ。新 API キーと SSO（§3.2） |
| 地図・店舗検索 | Google Maps JS / Places API (New) | 同じ。サーバー経由・`@vis.gl/react-google-maps`（§3.3） |
| スタイル | Tailwind CSS | Tailwind CSS v4 |
| ホスティング | Vercel（Hobby） | **Vercel Pro**（§3.7） |
| CI/CD | GitHub Actions ゲート + `vercel deploy --prebuilt` | そのまま流用 |

### 1.2 そのまま流用できる仕組み

| 仕組み | gyoza のファイル | ポイント |
|---|---|---|
| PWA マニフェスト | `app/manifest.ts` | `display: standalone`、アイコンは `purpose: any` と `maskable` の両方 |
| アイコン | `public/icon.svg` | 動的生成（`ImageResponse`）より静的ファイルが確実 |
| Service Worker | `public/sw.js` + `components/service-worker-register.tsx` | fetch ハンドラ付きの最小構成で、インストール要件を満たす |
| iOS インストール案内 | `hooks/use-ios-install-prompt.ts` | iOS Safari はインストールバナーを出さないため、手順を案内する |
| 新バージョン通知 | `components/update-checker.tsx` + `app/api/version/route.ts` | ビルド時の SHA と実行中の SHA を比べて、更新バナーを出す |
| デプロイゲート | `.github/workflows/ci.yml`、`deploy-production.yml` | lint・型チェック・テスト・ビルドが全部通ったときだけ本番にデプロイ。最後にスモークテスト |
| 絞り込み状態の保持 | `app/page.tsx` | 状態は URL クエリに置く（新規なら nuqs、§3.5） |
| 店舗検索→自動入力 | `components/place-search.tsx` | 検索結果を選ぶと名前・住所・座標・place_id が入る |
| 写真の縮小 | `lib/image-utils.ts` | canvas で JPEG に再エンコードすると EXIF（撮影位置 GPS）も消える。社員の位置情報漏れ防止に役立つ |
| エラー境界 | `app/error.tsx` | `error.digest` を表示し、ログと突き合わせられる |
| 確認ダイアログ・トースト | `components/confirm-dialog.tsx`、`toast.tsx` | Provider 方式。`role="dialog"` / `role="status"` 対応済み |
| テスト観点 | `docs/TEST_PLAN.md` | 認証・一覧・登録・詳細・編集・地図・PWA の観点表をそのまま雛形にできる |

---

## 2. トラブル記録と教訓（gyoza で実際に起きたこと）

| # | 起きたこと | 本当の原因 | 新規プロジェクトでの対策 |
|---|---|---|---|
| 1 | shops テーブルの中身が消え、ユーザーが追加した店は復元できなかった | Free プランに自動バックアップがない。他テーブルからの参照もない。写真ファイル名が UUID だけで、どの店の写真か分からない | 定期 dump（§3.2）、論理削除（`deleted_at`）、Storage のパスに店 ID を含める |
| 2 | 復元用の `seed.js` が動かなかった | `user_id` と RLS を追加したあとで seed を直していなかった。`.env.local` が CRLF 改行で読めていなかった | 初期データは `supabase/seed.sql` としてスキーマと一緒に管理する。環境変数は自前で解析せず `node --env-file=.env.local` を使う |
| 3 | 2つのアプリのテーブルが1つの Supabase プロジェクトに混在 | 無料枠の節約 | 専用プロジェクトにする。無理なら専用スキーマ（§3.2） |
| 4 | PWA をインストールしてもアプリ一覧に出ない | middleware が `sw.js` と `manifest.webmanifest` を `/login` にリダイレクトし、SW 登録が `SecurityError: The script resource is behind a redirect` で失敗していた。動的 PNG アイコンも不安定だった | proxy の matcher から公開アセットを除外する。インストールできないときは DevTools → Application → Manifest の Installability を最初に見る |
| 5 | push しても本番に反映されない | Vercel と GitHub が連携されていなかった | 初日に「push → 本番反映」の経路を一度通して確認する |
| 6 | CI の Lint だけ失敗 | ESLint 設定ファイルがなく、`next lint` が対話モードで止まった | Next.js 16 では `next lint` 自体がない。最初から ESLint flat config を置く |
| 7 | デプロイ後のスモークテストが失敗 | `/api/version` が認証対象でリダイレクトされていた。`--prebuilt` デプロイでは実行時に `VERCEL_GIT_COMMIT_SHA` が入らない | API は proxy の認証から外し、各 Route Handler で認可する。SHA はビルド時に定数として焼き込む |
| 8 | 詳細から戻ると絞り込みが消える | 状態を `useState` だけで持っていた。戻るボタンが `<Link href="/">` だった | 状態は URL に置く。戻るボタンは履歴に戻り、履歴がなければ `/` へ（§3.5） |
| 9 | 店舗検索が0件になり、地図に警告ポップアップ | Google Cloud の課金が無効になり、Places が 403、地図が `BillingNotEnabledMapError`。画面には何も出ていなかった | 失敗は画面に出す。予算アラートを設定する。課金を戻しても API が安定するまで数十分かかった |
| 10 | アイコンの見え方が端末で違う | 🥟 を SVG の `<text>` で描いていたため、端末の絵文字フォント次第で見た目が変わる | 絵文字はパス化された SVG 素材を使う（Twemoji や Noto Emoji。ライセンス表記を確認） |
| 11 | ピンチズームを禁止した | `userScalable: false` を設定 | iOS Safari は iOS 10 以降この設定を無視する。アクセシビリティ上も非推奨なので入れない |
| 12 | 同じ店を複数ユーザーが登録できない設計 | shops はユーザーごとの行なのに `place_id` がテーブル全体で一意 | 社内版はお店を共有テーブルにし、レビューを別テーブルに（§4.2） |
| 13 | 自動テストが不安定 | 自動操作ブラウザでフルリロードのたびに Maps を再読み込みしていた | Playwright でログイン状態（storageState）を保存して使い回す（§3.6） |
| 14 | 機密ファイルをコミットしかけた | `test_account.txt` を後から `.gitignore` に追加 | 初日に `.gitignore` を整え、GitHub の push protection（秘密情報検出）を有効にする |
| 15 | 案内ミス | 「Google Maps は月$200まで無料」と説明したが、2025年3月に廃止済みだった | 料金は必ず公式ページで確認する（§3.3） |

---

## 3. 今ならこう実装する（推奨）

### 3.1 Next.js 16

- **`proxy.ts`（旧 `middleware.ts`）**: Node.js ランタイムで動く。ファイル名と export 名を `proxy` に変える。`middleware.ts` は非推奨で、今後削除される。
- **matcher の除外例**（gyoza の教訓 #4・#7 を反映）:

  ```ts
  export const config = {
    matcher: [
      // api/ と PWA の公開アセットは認証リダイレクトさせない
      "/((?!api/|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
  };
  ```

- **`next lint` は廃止**: `eslint .` を直接使う。設定は flat config。`next build` も lint を実行しなくなった。
- **非同期 API**: `params`、`searchParams`、`cookies()`、`headers()` は `await` が必要。
- **キャッシュは明示的に**: Cache Components（`"use cache"`）は opt-in。何もしなければリクエストごとに実行される。
- **フォーム**: Server Actions + `useActionState`（React 19）。`CODING_STANDARDS.md` にある `useFormState` は旧名なので読み替える。
- **要件**: Node.js 20.9 以上、TypeScript 5.1 以上、Safari 16.4 以上。
- **Turbopack が既定**: webpack の独自設定が必要なときだけ `--webpack`。

### 3.2 Supabase

- **新しい API キー**: ブラウザ用は publishable キー（`sb_publishable_...`、旧 anon）、サーバー用は secret キー（`sb_secret_...`、旧 service_role）。secret キーはブラウザから使うと 401 になり、漏洩事故を防げる。旧キーは2026年末に非推奨になる見込み（要確認）なので、新規では最初から新キーを使う。
- **認証確認**: proxy とサーバー側では `supabase.auth.getClaims()` を使う（JWT の署名を公開鍵で検証する）。サーバー側で `getSession()` の内容を信用しない。
- **RLS の書き方**:
  - `auth.uid()` は `(select auth.uid())` と書く（行ごとに再評価させないため）。
  - ポリシーで使う列（`user_id` など）にはインデックスを張る。
  - RLS は権限のためのもの。絞り込みはクエリ側でも `.eq('user_id', ...)` を付ける。
- **バックアップ**: 自動の日次バックアップは Pro 以上のみ。Free では公式が `supabase db dump` での定期エクスポートを推奨している。GitHub Actions の cron で毎日 dump し、外部に保存する。
- **一時停止**: Free プランは7日間アクセスがないと一時停止されるとされる（要確認）。社内ツールは週末や長期休暇を挟むので、Pro にするか定期的に疎通する。
- **相乗りする場合**: アプリごとのスキーマを作り、API 設定の Exposed schemas に追加する。クライアントは `db: { schema: 'gourmet' }` で指定する。ただし基本は専用プロジェクト。
- **リージョン**: 東京（Northeast Asia）を選ぶ。

### 3.3 Google Maps Platform

- **料金体系（2025年3月〜）**: 月$200のクレジットは廃止され、SKU ごとの無料枠になった。目安は Essentials 月1万回、Pro 月5千回。正確な値は公式の料金表で確認する。
- **フィールドマスク = 課金額**: 1回のリクエストは、選んだフィールドの中で最も高い SKU で課金される。
  - ID だけ（`places.id`）は Essentials。
  - 名前・住所・座標は Pro 相当、`rating` を入れると Enterprise 相当になるとされる（要確認）。gyoza の周辺検索は `places.rating` を取っているので、新規では本当に必要か見直す。
- **キーの分け方**（Google 公式の推奨: クライアントとサーバーでキーを共有しない）:
  - ブラウザ用: HTTP リファラ制限 + Maps JavaScript API だけ許可。
  - サーバー用: API 制限（Places API だけ）+ サーバーの環境変数のみに置く。Vercel の関数は IP が固定されないため IP 制限は効きにくく、その分クォータ上限で守る。
  - Places 検索は Route Handler（例: `app/api/places/search/route.ts`）経由にし、ログイン済みユーザーだけが呼べるようにする。
- **使いすぎ防止**: Cloud Billing の予算アラートと、API ごとの「1日あたりリクエスト上限」クォータを設定する。課金が止まると API が全部止まるので、課金状態の確認も監視に入れる。
- **データの保存ルール**: `place_id` は無期限に保存してよい。緯度経度は最大30日まで。その他の項目（名前・評価・写真など）は原則として保存不可とされる（要確認）。社員が登録した店名・自分のレビューは自前のデータとして持ち、Google から取った情報を長期保存する場合は最新の規約を確認する。
- **地図ライブラリ**: `@vis.gl/react-google-maps`（Google のサンプルでも使われている。公式サポート対象ではない）。マーカーは `AdvancedMarker` を使う（`google.maps.Marker` は2024年2月から非推奨。AdvancedMarker には Map ID が必要）。

### 3.4 PWA

- Next.js 公式の PWA ガイドに沿って `app/manifest.ts` を置く。オフライン対応が要るときだけ Serwist を入れる（開発モードでは無効になる点に注意）。
- アイコンは静的 SVG（any + maskable）を基本にし、iOS 向けに 180px の PNG の apple-touch-icon も用意しておくと無難。
- ピンチズームは禁止しない（§2 #11）。ダブルタップ時の遅延が気になる要素には CSS の `touch-action: manipulation` を使う。
- インストールできないときの確認順: DevTools → Application → Manifest（Installability）→ Service Workers の登録状態 → `sw.js` と `manifest.webmanifest` が 200 で返るか。

### 3.5 状態管理とナビゲーション

- **URL に状態を置くなら nuqs**: `useState` と同じ感覚で URL クエリを型付きで扱える。ルートレイアウトを `NuqsAdapter` で包み、`useQueryState('status')` のように使う。gyoza で手書きした URL 同期処理が不要になる。
- **戻るボタンは履歴がないときの逃げ道を用意する**: gyoza は `router.back()` に変えたが、共有リンクや PWA 起動で詳細ページを直接開いた場合、戻るとアプリの外に出てしまう。

  ```tsx
  "use client";
  import { useRouter } from "next/navigation";

  export function useBackOrHome() {
    const router = useRouter();
    return () => {
      // 同じサイト内から来た場合だけ履歴を戻る。直接開いた場合はホームへ。
      const fromSameOrigin =
        document.referrer && new URL(document.referrer).origin === location.origin;
      if (fromSameOrigin && window.history.length > 1) router.back();
      else router.push("/");
    };
  }
  ```

### 3.6 テスト

- **E2E は Playwright**: ログイン処理を setup プロジェクトで1回だけ行い、storageState に保存して各テストで再利用する。テスト用アカウントは GitHub Secrets / `.env.test.local` に置き、リポジトリに入れない。
- **単体テストは Vitest**: 徒歩分数の計算、営業中判定、平均評価の計算など、純粋関数に絞って厚くする。
- **観点表**: gyoza の `docs/TEST_PLAN.md` をコピーし、レビュー・集計・権限（他人のレビューを編集できないこと）の観点を足す。

### 3.7 ホスティングと運用

- **Vercel Pro**（商用利用）。関数のリージョンは東京（`hnd1`）にし、Supabase の東京リージョンと揃える。
- **監視**: `/api/health` で Supabase と Places API の疎通を返し、GitHub Actions の cron か外形監視サービスで定期チェックする。
- **社内手続き**: Vercel・Supabase・Google Cloud を使う前に、情報システム部門の外部サービス利用申請（データの保存場所、アカウント管理、退職者対応）を通しておく。

---

## 4. 社内グルメアプリの設計提案

### 4.1 gyoza との違い

| 観点 | gyoza（個人用） | 社内グルメ |
|---|---|---|
| 利用者 | 1人 | 社員全員 |
| お店データ | ユーザーごと | **全員で共有** |
| 評価 | 自分の★だけ | **全員のレビューを集計**（平均★・件数） |
| 認証 | メール + パスワード | **社内 SSO + ドメイン制限** |
| 権限 | 自分のデータだけ | 閲覧は全員、編集は投稿者本人、削除は管理者も |
| 運用 | 自分で管理 | 通報・モデレーション、退職者のアカウント停止 |

### 4.2 データモデル（たたき台）

```sql
-- 社員プロフィール（auth.users と 1:1）
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  department text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- お店（全員で共有）
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,              -- Google の Place ID（無期限保存可）
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  walk_minutes smallint,             -- オフィスからの徒歩分数（§4.5）
  lunch_price_min int,
  lunch_price_max int,
  genre text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz              -- 論理削除（教訓 #1）
);

-- レビュー（1人1店1件。訪問履歴を残すなら visits テーブルを別に作る）
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  tags text[] not null default '{}',
  price_paid int,
  visited_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index on public.reviews (restaurant_id);
create index on public.reviews (user_id);

-- 集計ビュー（閲覧者の権限で評価される）
create view public.restaurant_stats with (security_invoker = true) as
select r.id as restaurant_id,
       count(v.id) as review_count,
       round(avg(v.rating)::numeric, 1) as avg_rating
from public.restaurants r
left join public.reviews v on v.restaurant_id = r.id
where r.deleted_at is null
group by r.id;

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.reviews enable row level security;

create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id);

create policy "restaurants_select" on public.restaurants
  for select to authenticated using (deleted_at is null);
create policy "restaurants_insert" on public.restaurants
  for insert to authenticated with check ((select auth.uid()) = created_by);

create policy "reviews_select" on public.reviews
  for select to authenticated using (true);
create policy "reviews_write_own" on public.reviews
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

- 写真は Storage に `restaurants/{restaurant_id}/{review_id}/{uuid}.jpg` の形で置く（教訓 #1: パスからどの店の写真か分かるように）。
- 管理者による削除は、`is_admin` を見るポリシーか、SECURITY DEFINER の関数で行う。
- マイグレーションは `supabase/migrations/` に連番で置き、`CI_CD_SETUP.md` の台帳チェックを使う。

### 4.3 機能案（優先度順）

**MVP（最初のリリース）**
- 社内 SSO ログイン（会社ドメインだけ）
- お店登録（店名検索→自動入力。重複は `place_id` で弾き、既存の店へ案内）
- レビュー投稿（★・コメント・写真・タグ・払った金額）
- 一覧（徒歩分数・平均★・ランチ価格で並べ替えと絞り込み、条件は URL に保持）
- 地図表示、お店詳細（レビュー一覧つき）

**次の段階**
- 「今日のランチ」ランダム提案（徒歩◯分以内・予算・ジャンル指定）
- 行きたいリスト、レビューへの「参考になった」
- 新しいお店が登録されたら Slack に通知

**社内アプリならではのタグ案**
- 一人で入りやすい / 4人以上OK / 予約できる
- 12時台の混み具合、提供の速さ（昼休み60分で戻れるか）
- インボイス対応の領収書、テイクアウト可、席数

### 4.4 お店データの取り方

| 取得元 | 向いている用途 | 注意点 |
|---|---|---|
| Google Places API (New) | 網羅性、`place_id` による重複判定、地図との相性 | 課金とデータ保存ルール（§3.3） |
| ホットペッパーグルメ Web サービス | ランチ有無（`lunch=1`）、半径300m〜の検索、席数、写真、営業時間 | `budget` はディナー予算でランチ価格ではない。旧 API（api.hotpepper.jp）は2023年10月に終了しているので現行の API を使う。登録方法とクレジット表記は利用規約で確認 |
| 社員の入力 | ランチ価格・混み具合・速さなど | 一番価値がある情報。入力しやすさを優先して UI を作る |

### 4.5 徒歩分数の出し方

- 目安は不動産広告と同じ「徒歩1分 = 80m」。
- 直線距離で計算すると実際より短く出るので、お店を登録したときに経路 API で一度だけ計算して `walk_minutes` に保存するのがおすすめ（オフィスは固定なので毎回計算する必要はない）。

### 4.6 プライバシーと社内ルール

- 写真の EXIF（撮影位置）を必ず消す（gyoza の canvas 縮小方式で実現できる）。
- 投稿者名は実名かニックネームかを選べるようにする。
- 不適切な投稿の通報と、管理者による非表示を用意する。
- お店への誹謗中傷にならないよう、投稿ガイドラインを画面に出す。
- 退職者は SSO 側で止まるので、`profiles` のレビュー表示（匿名化するか残すか）を決めておく。

---

## 5. 立ち上げチェックリスト

**初日に済ませる**
- [ ] 情報システム部門の外部サービス利用申請
- [ ] Vercel Pro チームを作り、GitHub と連携。push から本番反映まで一度通す
- [ ] Supabase の専用プロジェクトを東京リージョンで作成。新 API キー（publishable / secret）を使う
- [ ] 社内 SSO を設定し、Before User Created フックで会社ドメインに限定（拒否時のエラーメッセージの見え方も確認）
- [ ] Google Cloud: ブラウザ用・サーバー用のキーを分けて制限、予算アラート、API ごとの日次クォータ
- [ ] `.gitignore`（`.env*.local`、テストアカウント類）と GitHub push protection
- [ ] `docs/` に `UI_REFERENCE.md`・`CODING_STANDARDS.md`・`CI_CD_SETUP.md`・本ファイルをコピー

**最初の1週間**
- [ ] CI（lint・型チェック・テスト・ビルド）と本番デプロイゲート、スモークテスト
- [ ] `supabase db dump` の定期実行（GitHub Actions cron）
- [ ] proxy の matcher で `api/`、`sw.js`、`manifest.webmanifest` を除外
- [ ] `/api/health` と疎通監視
- [ ] Playwright のログイン済み状態の保存と、主要フローの E2E

**公開前**
- [ ] 他人のレビューを編集・削除できないことを確認（RLS）
- [ ] スマホ実機（Android Chrome / iOS Safari）で PWA インストール
- [ ] 外部 API が失敗したときに画面にエラーが出ることを確認
- [ ] 投稿ガイドライン、通報、管理者削除

---

## 参考リンク

**Next.js**
- [Next.js 16 リリース記事](https://nextjs.org/blog/next-16)
- [Next.js 16 アップグレードガイド](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js PWA ガイド](https://nextjs.org/docs/app/building-your-application/configuring/progressive-web-apps)

**Supabase**
- [新しい API キー（publishable / secret）への移行](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [API キーの変更予告（changelog）](https://supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys)
- [SSR 用クライアントの作り方（getClaims の推奨）](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [RLS のパフォーマンスとベストプラクティス](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [バックアップ（プランごとの違い）](https://supabase.com/docs/guides/platform/backups)
- [Before User Created フック（ドメイン制限の例あり）](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [カスタムスキーマの公開](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Free プランの制限まとめ（第三者）](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)

**Google Maps Platform**
- [2025年3月の料金体系変更](https://developers.google.com/maps/billing-and-pricing/march-2025)
- [Places API の利用量と課金（SKU の決まり方）](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [API キー制限のベストプラクティス](https://mapsplatform.google.com/resources/blog/google-maps-platform-best-practices-restricting-api-keys/)
- [非推奨機能の一覧（Marker → AdvancedMarker）](https://developers.google.com/maps/deprecations)
- [React Google Maps Library のサンプル](https://developers.google.com/maps/documentation/javascript/examples/rgm-basic-map)
- [Places のデータ保存ルールまとめ（第三者）](https://openplacesapi.com/blog/can-you-store-places-api-results)
- [Places の SKU と料金まとめ（第三者）](https://openplacesapi.com/blog/google-places-api-pricing)

**その他**
- [Vercel Hobby プラン（非商用限定）](https://vercel.com/docs/plans/hobby)
- [Vercel フェアユースガイドライン](https://vercel.com/docs/limits/fair-use-guidelines)
- [nuqs](https://github.com/47ng/nuqs)
- [iOS 10 でのズーム設定の無視（WebKit）](https://webkit.org/?p=7367)
- [リクルート Web サービス（ホットペッパーグルメ）](https://webservice.recruit.co.jp/)
- [グルメサーチ API リファレンス](https://webservice.recruit.co.jp/doc/hotpepper/reference.html)
