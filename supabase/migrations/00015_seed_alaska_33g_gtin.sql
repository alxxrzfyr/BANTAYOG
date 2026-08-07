-- BANTAYOG migration 00015
-- Add the confirmed Alaska Fortified Powdered Milk Drink 33 g barcode.
-- Requires migrations 00013 and 00014 (products.gtin + unique index).

INSERT INTO public.products (
    name,
    category,
    eligibility_status,
    price_range_min,
    price_range_max,
    gtin
)
VALUES (
    'Alaska Fortified Powdered Milk Drink (33 g)',
    'DAIRY',
    'eligible',
    35,
    80,
    '4800575142633'
)
ON CONFLICT (gtin) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    eligibility_status = EXCLUDED.eligibility_status,
    price_range_min = EXCLUDED.price_range_min,
    price_range_max = EXCLUDED.price_range_max;
