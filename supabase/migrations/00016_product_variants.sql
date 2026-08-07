-- BANTAYOG migration 00016
-- Normalize exact sellable SKUs away from generic product families.
-- Existing products rows remain compatible; non-null legacy GTINs are copied into
-- variants so barcode lookup can move to the exact-SKU table without data loss.

CREATE TABLE IF NOT EXISTS public.product_variants (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id            UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku                   TEXT,
    brand                 TEXT,
    name                  TEXT NOT NULL,
    net_content           TEXT,
    flavour               TEXT,
    packaging_type        TEXT,
    category              TEXT NOT NULL,
    image_url             TEXT,
    gtin                  TEXT UNIQUE,
    eligibility_status    TEXT NOT NULL CHECK (eligibility_status IN ('eligible', 'ineligible')),
    price_range_min       NUMERIC(10,2) NOT NULL CHECK (price_range_min >= 0),
    price_range_max       NUMERIC(10,2) NOT NULL CHECK (price_range_max >= price_range_min),
    source_url            TEXT,
    verification_status   TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'LEGACY_IMPORTED')),
    verified_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
    ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_brand
    ON public.product_variants(brand);
CREATE INDEX IF NOT EXISTS idx_product_variants_verification_status
    ON public.product_variants(verification_status);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_product_variants ON public.product_variants;
DROP POLICY IF EXISTS authenticated_read_product_variants ON public.product_variants;

CREATE POLICY admin_all_product_variants ON public.product_variants
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY authenticated_read_product_variants ON public.product_variants
    FOR SELECT TO authenticated USING (true);

-- Preserve every existing exact barcode as a variant. Generic products with a
-- NULL GTIN remain family-level rows and intentionally produce no variant.
INSERT INTO public.product_variants (
    product_id,
    name,
    category,
    image_url,
    gtin,
    eligibility_status,
    price_range_min,
    price_range_max,
    verification_status
)
SELECT
    p.id,
    p.name,
    p.category,
    p.image_url,
    p.gtin,
    p.eligibility_status,
    p.price_range_min,
    p.price_range_max,
    'LEGACY_IMPORTED'
FROM public.products AS p
WHERE p.gtin IS NOT NULL
ON CONFLICT (gtin) DO NOTHING;

-- The 33 g Alaska SKU was independently confirmed before this migration.
-- Keep the generic family row untouched while giving the exact variant its
-- verified package metadata.
UPDATE public.product_variants
SET brand = 'Alaska',
    net_content = '33 g',
    packaging_type = 'Sachet',
    verification_status = 'VERIFIED',
    verified_at = COALESCE(verified_at, now()),
    updated_at = now()
WHERE gtin = '4800575142633';

-- The variant table is authoritative after migration. Clear copied legacy
-- barcode values so one GTIN has one storage location.
UPDATE public.products
SET gtin = NULL
WHERE gtin IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM public.product_variants AS v
      WHERE v.gtin = public.products.gtin
  );

COMMENT ON TABLE public.products IS
    'Product families and legacy catalog rows. Exact sellable SKUs belong in product_variants.';
CREATE OR REPLACE FUNCTION public.touch_product_variants_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_touch_updated_at ON public.product_variants;
CREATE TRIGGER product_variants_touch_updated_at
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION public.touch_product_variants_updated_at();

COMMENT ON TABLE public.product_variants IS
    'Exact sellable product variants. GTIN is unique here and must match one physical SKU.';
