<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 本番の更新ルール

- 本番（Vercel, https://pe-shoplog.vercel.app ）は `main` ブランチからデプロイされる。
- 本番を更新するときは、作業ブランチの変更を `main` にマージして push する（ユーザー指示: 2026-11-01）。
- 本番 Supabase は `biz-works`（ref: jpwazqjrqtlbwfvagstx, Tokyo）。別プロジェクト `porygon-works` には触らない。マイグレーションを含む場合は、マージ前に本番 DB へ適用する（README「運用」参照）。
