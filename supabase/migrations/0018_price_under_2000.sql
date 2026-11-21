-- 値段感に「〜1,999」（under_2000）を追加する。既存の値・データはそのまま（追加的な変更のみ）。
-- 選択肢の並びと表示名は src/lib/options.ts の PRICE_RANGES。

alter table public.visits drop constraint visits_price_range_check;
alter table public.visits add constraint visits_price_range_check check (price_range in (
  'under_2000','under_3000','3000_4999','5000_6999','7000_9999','over_10000','unknown'));
