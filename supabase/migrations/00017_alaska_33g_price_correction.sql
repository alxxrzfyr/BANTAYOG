-- BANTAYOG migration 00017
-- Correct the retail price band of the Alaska Fortified Powdered Milk Drink
-- 33 g sachet.
--
-- Migration 00015 seeded 35-80 PHP for this SKU. That band is the price of a
-- multi-sachet pack, not of one 33 g sachet, which sells for 7-15 PHP. A
-- merchant who scanned the sachet saw a price band that no correct sale can
-- satisfy.
--
-- Requires migration 00016: product_variants holds the GTIN after that
-- migration, and products.gtin is NULL, so the family row is reached through
-- the variant's product_id.

UPDATE public.product_variants
SET price_range_min = 7.00,
    price_range_max = 15.00,
    updated_at = now()
WHERE gtin = '4800575142633';

-- Keep the family row consistent with its only variant, so the name lookup and
-- the AI fallback quote the same band as the barcode path.
UPDATE public.products
SET price_range_min = 7.00,
    price_range_max = 15.00
WHERE id IN (
    SELECT product_id
    FROM public.product_variants
    WHERE gtin = '4800575142633'
);
