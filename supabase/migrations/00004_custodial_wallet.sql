-- =============================================================================
-- BANTAYOG — Migration 00004: Custodial Wallet Model
--
-- Adds off-chain wallet_balance to merchants, relaxes wallet_address to nullable,
-- adds cashout_in_progress flag, and creates the settle_sale RPC for atomic
-- settlement (deduct beneficiary credit + credit merchant balance + insert tx).
--
-- Requirements: 1.1, 1.4, 1.6, 1.7, 14.3
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add wallet_balance column (Req 1.1, 1.7)
--    Custodial balance: merchant's earned PHPC held off-chain.
--    NUMERIC(12,2) ensures 2-decimal precision; CHECK ensures >= 0.
-- -----------------------------------------------------------------------------
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (wallet_balance >= 0);

-- -----------------------------------------------------------------------------
-- 2. Relax wallet_address NOT NULL constraint (Req 14.3)
--    Merchants now connect their own wallet later; address starts as null.
-- -----------------------------------------------------------------------------
ALTER TABLE public.merchants
  ALTER COLUMN wallet_address DROP NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Add cashout_in_progress flag (needed for concurrent cash-out guard)
-- -----------------------------------------------------------------------------
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS cashout_in_progress BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- 4. settle_sale RPC (Req 1.4, 1.6)
--    Atomically: deduct beneficiary credit, credit merchant wallet_balance,
--    and insert the transaction row with status = 'CONFIRMED'.
--    Raises an exception on any failure so the entire transaction rolls back.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_sale(
  p_beneficiary_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC(12,2),
  p_items JSONB,
  p_transaction_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_credit NUMERIC(12,2);
BEGIN
  -- Validate amount is positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- Lock and read the beneficiary's current credit balance
  SELECT credit_balance INTO v_current_credit
    FROM public.beneficiaries
    WHERE id = p_beneficiary_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beneficiary not found: %', p_beneficiary_id;
  END IF;

  -- Check sufficient credit (Req 1.5)
  IF v_current_credit < p_amount THEN
    RAISE EXCEPTION 'Insufficient beneficiary credit balance. Available: %, Required: %',
      v_current_credit, p_amount;
  END IF;

  -- Deduct beneficiary credit (Req 1.4)
  UPDATE public.beneficiaries
    SET credit_balance = credit_balance - p_amount
    WHERE id = p_beneficiary_id;

  -- Credit merchant wallet_balance (Req 1.2)
  UPDATE public.merchants
    SET wallet_balance = wallet_balance + p_amount
    WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Merchant not found: %', p_merchant_id;
  END IF;

  -- Insert the transaction row with status = CONFIRMED (Req 10.1)
  INSERT INTO public.transactions (
    id,
    beneficiary_id,
    merchant_id,
    item_list_jsonb,
    total_amount,
    status,
    created_at
  ) VALUES (
    p_transaction_id,
    p_beneficiary_id,
    p_merchant_id,
    p_items,
    p_amount,
    'CONFIRMED',
    now()
  );

  RETURN p_transaction_id;
END;
$$;
