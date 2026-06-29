-- =============================================================================
-- BANTAYOG — Seed data
-- BE1 owns this file. Seeds the nutritional allowlist (10 categories)
-- that domain/nutrition-policy.ts uses for item validation.
-- =============================================================================

-- Nutritional allowlist categories (matches domain/nutrition-policy.ts ALLOWLIST)
INSERT INTO public.item_categories (category, label_en, label_fil, sort_order) VALUES
  ('EGGS',        'Eggs',              'Itlog',              1),
  ('FRESH_MILK',  'Fresh Milk',        'Sariwang Gatas',     2),
  ('POWDERED_MILK','Powdered Milk',    'Gatas na Pulbos',    3),
  ('VEGETABLES',  'Vegetables',        'Gulay',              4),
  ('LEAN_MEAT',   'Lean Meat',         'Karne',              5),
  ('FISH',        'Fish',              'Isda',               6),
  ('BEANS_LENTILS','Beans & Lentils',  'Munggo at Sitsaro',  7),
  ('RICE_BROWN',  'Brown Rice',        'Itim na Bigas',      8),
  ('FRUIT_FRESH', 'Fresh Fruit',       'Sariwang Prutas',    9),
  ('NUT_BUTTER',  'Nut Butter',        'Mani na Mantika',   10)
ON CONFLICT (category) DO NOTHING;
