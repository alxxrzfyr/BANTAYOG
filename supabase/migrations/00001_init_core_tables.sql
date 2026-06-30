-- =============================================================================
-- BANTAYOG — Migration 00001: Core tables + RLS policies
--
-- Creates exactly 5 tables per spec:
--   1. beneficiaries  — guardian–child pairs with eligibility + credit balance
--   2. merchants      — sari-sari store owners with wallet binding
--   3. transactions   — purchase records linking beneficiaries and merchants
--   4. products       — catalog of eligible/ineligible nutritional items
--   5. qr_passes      — signed QR tokens issued to beneficiaries
--
-- RLS is enabled on every table. Policies follow the RBAC convention:
--   admin:       full CRUD on all tables
--   merchant:    scoped access to own transactions, product reads
--   beneficiary: read self only (no app surface in v1)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. beneficiaries
-- Columns follow the existing schema convention from the original migration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beneficiaries (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_name         TEXT NOT NULL,
    guardian_mobile_hash  TEXT NOT NULL,
    child_name            TEXT NOT NULL,
    child_age_months      INTEGER NOT NULL CHECK (child_age_months >= 0 AND child_age_months <= 120),
    monthly_income_php    NUMERIC(12,2) NOT NULL CHECK (monthly_income_php >= 0),
    gps_lat               DOUBLE PRECISION NOT NULL CHECK (gps_lat >= -90 AND gps_lat <= 90),
    gps_lng               DOUBLE PRECISION NOT NULL CHECK (gps_lng >= -180 AND gps_lng <= 180),
    pin_hash_argon2id     TEXT,
    pin_salt              TEXT,
    eligibility_status    TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (eligibility_status IN ('PENDING', 'ELIGIBLE', 'INELIGIBLE', 'SUSPENDED')),
    credit_balance        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
    card_serial           TEXT UNIQUE,
    activated_at          TIMESTAMPTZ,
    deactivated_at        TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_card_serial
    ON public.beneficiaries(card_serial);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_eligibility_status
    ON public.beneficiaries(eligibility_status);

-- -----------------------------------------------------------------------------
-- 2. merchants
-- Columns follow the existing schema convention from the original migration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_name        TEXT NOT NULL,
    owner_name        TEXT NOT NULL,
    mobile_number_e164 TEXT NOT NULL,
    wallet_address    TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchants_auth_user_id
    ON public.merchants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_wallet_address
    ON public.merchants(wallet_address);
CREATE INDEX IF NOT EXISTS idx_merchants_status
    ON public.merchants(status);

-- -----------------------------------------------------------------------------
-- 3. transactions
-- Columns follow the existing schema convention from the original migration.
-- Removed: stablecoin_amount_wei, onchain_tx_hash, idempotency_key,
--          confirmed_at (not in spec).
-- Added: total_amount to match spec's "total amount" column.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id      UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
    merchant_id         UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
    item_list_jsonb     JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status              TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'FAILED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_beneficiary_id
    ON public.transactions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id
    ON public.transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON public.transactions(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. products
-- New table: nutritional product catalog with eligibility classification.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    category          TEXT NOT NULL,
    eligibility_status TEXT NOT NULL
                          CHECK (eligibility_status IN ('eligible', 'ineligible')),
    price_range_min   NUMERIC(10,2) NOT NULL CHECK (price_range_min >= 0),
    price_range_max   NUMERIC(10,2) NOT NULL CHECK (price_range_max >= price_range_min),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category
    ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_eligibility_status
    ON public.products(eligibility_status);

-- -----------------------------------------------------------------------------
-- 5. qr_passes
-- Renamed from qr_tokens to qr_passes per spec. Same column convention.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_passes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id  UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
    token_payload   TEXT NOT NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_qr_passes_beneficiary_id
    ON public.qr_passes(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_qr_passes_expires_at
    ON public.qr_passes(expires_at);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Convention from original migration: has_role() helper, admin_all_* policies,
-- self-read for own records, merchant-scoped for transactions.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_passes ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Helper: check if current user has a specific role
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND (
        raw_app_meta_data->>'role' = required_role
        OR raw_app_meta_data->>'role' = 'admin'  -- admin can do everything
      )
  )
$$;

-- -----------------------------------------------------------------------------
-- beneficiaries: admin full CRUD; no merchant/beneficiary direct access
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_beneficiaries ON public.beneficiaries
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

-- -----------------------------------------------------------------------------
-- merchants: admin full CRUD; merchant read/update own
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_merchants ON public.merchants
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY self_read_merchants ON public.merchants
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY self_update_merchants ON public.merchants
    FOR UPDATE USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- transactions: admin full CRUD; merchant read/insert own
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_transactions ON public.transactions
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY merchant_read_own_transactions ON public.transactions
    FOR SELECT USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY merchant_insert_own_transactions ON public.transactions
    FOR INSERT WITH CHECK (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- products: admin full CRUD; all authenticated users can read
-- (needed for AI scan validation and manual entry)
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_products ON public.products
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY authenticated_read_products ON public.products
    FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- qr_passes: admin full CRUD
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_qr_passes ON public.qr_passes
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

-- =============================================================================
-- Storage buckets + RLS policies
-- =============================================================================

-- Create private buckets (authenticated access only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('cart-photos', 'cart-photos', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('qr-passes', 'qr-passes', false, 10485760, ARRAY['image/png', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects: authenticated-only access
-- cart-photos: merchants can upload/read their own transaction photos
CREATE POLICY merchant_insert_cart_photos ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'cart-photos');

CREATE POLICY merchant_read_cart_photos ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'cart-photos');

-- qr-passes: authenticated users can read QR pass images
CREATE POLICY authenticated_read_qr_passes ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'qr-passes');

CREATE POLICY authenticated_insert_qr_passes ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'qr-passes');

-- =============================================================================
-- Done. 5 tables created with RLS enforced:
--   beneficiaries, merchants, transactions, products, qr_passes
-- Plus: has_role() helper, 2 storage buckets with RLS policies.
-- =============================================================================
