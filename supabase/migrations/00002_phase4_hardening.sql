-- =============================================================================
-- BANTAYOG — Migration 00002: Phase 4 Hardening Schema additions
-- =============================================================================

-- 1. Add intervention_tier to beneficiaries (1=Critical, 2=Standard)
ALTER TABLE public.beneficiaries 
ADD COLUMN IF NOT EXISTS intervention_tier INTEGER NOT NULL DEFAULT 1 CHECK (intervention_tier IN (1, 2));

-- 2. Add credit and blockchain fields to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS total_credit_deducted NUMERIC(12,2) DEFAULT 0 CHECK (total_credit_deducted >= 0),
ADD COLUMN IF NOT EXISTS stablecoin_amount_wei TEXT,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS onchain_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 3. Update transactions status constraint to match the transaction state machine
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;

-- Migrate existing rows to match new statuses
UPDATE public.transactions SET status = 'PENDING_CHAIN' WHERE status = 'PENDING';
UPDATE public.transactions SET status = 'RECONCILED' WHERE status = 'COMPLETED';

ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('PENDING_CHAIN', 'SUBMITTED', 'CONFIRMED', 'RECONCILED', 'FAILED'));

ALTER TABLE public.transactions ALTER COLUMN status SET DEFAULT 'PENDING_CHAIN';

-- 4. Create outbox table for Transactional Outbox pattern
CREATE TABLE IF NOT EXISTS public.outbox (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            TEXT NOT NULL,
    payload_jsonb   JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON public.outbox(status, created_at);

-- Enable RLS on outbox
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

-- Allow only admin role to access outbox table (services bypass RLS via service role key)
CREATE POLICY admin_all_outbox ON public.outbox
    FOR ALL USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));
