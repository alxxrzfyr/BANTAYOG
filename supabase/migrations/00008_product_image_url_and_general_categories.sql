-- Add image_url column to public.products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update categories to the new general set
UPDATE public.products
SET category = 
  CASE 
    WHEN category IN ('Instant Food', 'Spreads', 'CANNED_AND_PACKAGED_GOODS') THEN 'CANNED_GOODS'
    WHEN category IN ('Eggs', 'DAIRY_AND_EGGS') THEN 'DAIRY'
    WHEN category IN ('Legumes') THEN 'VEGETABLES'
    WHEN category IN ('Seafood') THEN 'MEATS'
    WHEN category IN ('Dairy') THEN 'DAIRY'
    WHEN category IN ('Beverages') THEN 'BEVERAGES'
    WHEN category IN ('Snacks', 'SNACKS_AND_SWEETS') THEN 'SNACKS'
    WHEN category IN ('Grains', 'BAKERY_AND_GRAINS') THEN 'GRAINS'
    WHEN category IN ('Fruits') THEN 'FRUITS'
    WHEN category IN ('Vegetables') THEN 'VEGETABLES'
    WHEN category IN ('Meat') THEN 'MEATS'
    WHEN category IN ('WHOLE_FOODS') THEN 'VEGETABLES' -- Fallback from previous general schema
    WHEN category IN ('MEAT_POULTRY_SEAFOOD') THEN 'MEATS' -- Fallback from previous general schema
    ELSE 'OTHER'
  END;
