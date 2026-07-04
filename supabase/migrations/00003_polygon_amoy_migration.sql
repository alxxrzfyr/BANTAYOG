-- =============================================================================
-- BANTAYOG — Migration 00003: Polygon Amoy custodial wallets + tier allocations
--
-- Adds 2 tables to support the Polygon Amoy PHPC migration:
--   1. beneficiary_wallets — one custodial EVM wallet per beneficiary,
--      private key held only as AES-256-GCM ciphertext (never plaintext).
--   2. allocations          — one-time tier-based PHPC allocation record per
--      beneficiary, used as an idempotency guard and reconciliation flag.
--
-- RLS is enabled on both tables following the has_role() convention from
-- migration 00001: admin has full CRUD, no merchant/beneficiary direct access
-- (services use the service role key and bypass RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. beneficiary_wallets
-- One-to-one with beneficiaries. Address is globally unique. Key material is
-- never stored in plaintext — only ciphertext/iv/authTag from AES-256-GCM.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beneficiary_wallets (
    beneficiary_id   UUID PRIMARY KEY REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
    address          TEXT NOT NULL UNIQUE CHECK (address ~ '^0x[0-9a-fA-F]{40}$'),
    enc_ciphertext   TEXT NOT NULL,
    enc_iv           TEXT NOT NULL,
    enc_auth_tag     TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beneficiary_wallets_address
    ON public.beneficiary_wallets(address);

-- -----------------------------------------------------------------------------
-- 2. allocations
-- One-time tier-based allocation per beneficiary. The UNIQUE constraint on
-- beneficiary_id is the idempotency guard preventing a second allocation
-- (Requirement 4.7). `reconciled` defaults to false and is flagged false on
-- a recorded-vs-on-chain balance mismatch (Requirement 4.6).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allocations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id   UUID NOT NULL UNIQUE REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
    tier             INTEGER NOT NULL CHECK (tier IN (1, 2)),
    amount_phpc      NUMERIC(12,2) NOT NULL CHECK (amount_phpc IN (5000, 3500)),
    onchain_tx_hash  TEXT,
    reconciled       BOOLEAN NOT NULL DEFAULT false,
    allocated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allocations_beneficiary_id
    ON public.allocations(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_allocations_reconciled
    ON public.allocations(reconciled);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Convention from migration 00001: has_role() helper, admin_all_* policies.
-- Services access these tables via the service role key (bypasses RLS).
-- =============================================================================

ALTER TABLE public.beneficiary_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_beneficiary_wallets ON public.beneficiary_wallets
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY admin_all_allocations ON public.allocations
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

-- =============================================================================
-- Done. 2 tables created with RLS enforced:
--   beneficiary_wallets, allocations
-- =============================================================================
