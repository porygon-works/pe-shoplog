-- Manual dev data only (tests create their own fixtures).
insert into public.shops (name, lat, lng, genre, styles) values
  ('居酒屋 サンプル', 35.6812, 139.7671, 'washoku', array['izakaya']),
  ('ビストロ サンプル', 35.6896, 139.7006, 'french_bistro', array['dining_bar']),
  ('焼肉 サンプル', 35.6580, 139.7016, 'yakiniku', array['private_room']);
