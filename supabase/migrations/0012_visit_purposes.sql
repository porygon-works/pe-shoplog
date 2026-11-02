-- 用途の選択肢を入れ替える。既存の値（team_meeting・all_hands・celebration・welcome_farewell・
-- peers_only・entertainment・other）はそのまま使い、表示名だけアプリ側で変える。
-- 追加: training_2（養成講座２部）・mentor（メンター面談）・after_work（しごおわ）・all_night（朝まで）。
-- 外す: private（プライベート。使っている記録はない）。データは変更しない。
alter table public.visits drop constraint visits_purpose_check;
alter table public.visits add constraint visits_purpose_check check (purpose in (
  'training_2','mentor','team_meeting','after_work','all_night','all_hands','celebration',
  'welcome_farewell','peers_only','entertainment','other','unknown'));
