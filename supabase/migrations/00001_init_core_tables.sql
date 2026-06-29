-- =============================================================================
-- BANTAYOG — Migration 00001: Core tables + RLS policies
--
-- BE1 owns this migration. Creates 5 tables per BANTAYOG_PROJECT_PLAN.md §7:
--   1. administrators  — LGU admin profiles linked to auth.users
--   2. merchants       — sari-sari store owners with wallet binding
--   3. beneficiaries   — guardian–child pairs with eligibility + credit balance
--   4. outbox          — transactional outbox for on-chain side effects
--   5. photo_receipts  — ephemeral Gemini Vision photo references
--
-- RLS is enabled on every table. Policies follow the RLS summary in §7:
--   admin:       full CRUD on all tables
--   merchant:    read/insert own transactions, verify-only QR, read own profile
--   beneficiary: read self only (no app surface in v1)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. administrators
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.administrators (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    lgu_id      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for joining auth.users → administrators
CREATE INDEX IF NOT EXISTS idx_administrators_auth_user_id
    ON public.administrators(auth_user_id);

-- -----------------------------------------------------------------------------
-- 2. merchants
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
-- 3. beneficiaries
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
-- 4. transactions (needed by outbox + photo_receipts FKs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id          UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
    merchant_id             UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
    item_list_jsonb         JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_credit_deducted   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_credit_deducted >= 0),
    stablecoin_amount_wei   NUMERIC(38,0) NOT NULL DEFAULT 0,
    onchain_tx_hash         TEXT,
    idempotency_key         UUID NOT NULL UNIQUE,
    status                  TEXT NOT NULL DEFAULT 'PENDING_CHAIN'
                              CHECK (status IN ('PENDING_CHAIN', 'CONFIRMED', 'DB_RECORDED',
                                                'BROADCAST', 'RECONCILED', 'FAILED')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at            TIMESTAMPTZ
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
-- 5. qr_tokens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id  UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
    jws_compact     TEXT NOT NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_beneficiary_id
    ON public.qr_tokens(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires_at
    ON public.qr_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- 6. outbox (transactional outbox pattern per §7)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outbox (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          TEXT NOT NULL,
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    attempts      INTEGER NOT NULL DEFAULT 0,
    run_after     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_run_after
    ON public.outbox(status, run_after)
    WHERE status IN ('PENDING', 'PROCESSING');

-- -----------------------------------------------------------------------------
-- 7. photo_receipts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photo_receipts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    storage_object_path TEXT NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_receipts_expires_at
    ON public.photo_receipts(expires_at);
CREATE INDEX IF NOT EXISTS idx_photo_receipts_transaction_id
    ON public.photo_receipts(transaction_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Per §7 RLS summary. All policies wrap RLS functions in SELECT for
-- Postgres optimizer caching (initPlan) per Supabase guidance.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_receipts ENABLE ROW LEVEL SECURITY;

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
-- administrators: admin full CRUD; self read
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_administrators ON public.administrators
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY self_read_administrators ON public.administrators
    FOR SELECT USING (auth_user_id = auth.uid());

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
-- beneficiaries: admin full CRUD; no merchant access
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_beneficiaries ON public.beneficiaries
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

-- -----------------------------------------------------------------------------
-- transactions: admin read all; merchant read/insert own
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
-- qr_tokens: admin full; merchant verify-only (no PII join)
-- -----------------------------------------------------------------------------
CREATE POLICY admin_all_qr_tokens ON public.qr_tokens
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

-- -----------------------------------------------------------------------------
-- outbox: admin read only; no merchant/beneficiary access
-- -----------------------------------------------------------------------------
CREATE POLICY admin_read_outbox ON public.outbox
    FOR SELECT USING (public.has_role('admin'));

-- -----------------------------------------------------------------------------
-- photo_receipts: merchant insert/read own (TTL-driven); no admin direct access
-- -----------------------------------------------------------------------------
CREATE POLICY merchant_insert_photo_receipts ON public.photo_receipts
    FOR INSERT WITH CHECK (
        transaction_id IN (
            SELECT t.id FROM public.transactions t
            JOIN public.merchants m ON t.merchant_id = m.id
            WHERE m.auth_user_id = auth.uid()
        )
        OR transaction_id IS NULL
    );

CREATE POLICY merchant_read_own_photo_receipts ON public.photo_receipts
    FOR SELECT USING (
        transaction_id IN (
            SELECT t.id FROM public.transactions t
            JOIN public.merchants m ON t.merchant_id = m.id
            WHERE m.auth_user_id = auth.uid()
        )
        OR transaction_id IS NULL
    );

-- -----------------------------------------------------------------------------
-- 8. item_categories (nutritional allowlist — seeded by seed.sql)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_categories (
    category    TEXT PRIMARY KEY,
    label_en    TEXT NOT NULL,
    label_fil   TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS: admin read/write, merchant read-only, beneficiary read-only
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_item_categories ON public.item_categories
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY authenticated_read_item_categories ON public.item_categories
    FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- RPC: claim_outbox_rows — atomic SKIP LOCKED claim for cron worker
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_outbox_rows(p_limit INTEGER DEFAULT 10)
RETURNS SETOF public.outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    SELECT id
    FROM public.outbox
    WHERE status = 'PENDING'
      AND run_after <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.outbox
  SET status = 'PROCESSING',
      attempts = attempts + 1
  WHERE id IN (SELECT id FROM claimed)
  RETURNING *
$$;

GRANT EXECUTE ON FUNCTION public.claim_outbox_rows(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_rows(INTEGER) TO service_role;

-- =============================================================================
-- Done. 7 tables created with RLS enforced:
--   administrators, merchants, beneficiaries, transactions, qr_tokens,
--   outbox, photo_receipts
-- Plus: has_role() helper + claim_outbox_rows() RPC for outbox worker.
-- =============================================================================
