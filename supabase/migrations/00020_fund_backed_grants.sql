-- BE1 owns this file. Requirements: funded grant contract. Sandbox only.
BEGIN;

CREATE TABLE public.fund_grant_reservations (
  beneficiary_id UUID PRIMARY KEY REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
  attempt_id UUID NOT NULL UNIQUE,
  amount_php NUMERIC(12,2) NOT NULL CHECK (amount_php IN (5000.00, 3500.00)),
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'ISSUED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fund_grant_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_grant_reservations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.fund_grant_reservations TO service_role;

CREATE FUNCTION public.reserve_grant_funding(p_beneficiary_id UUID, p_attempt_id UUID, p_amount_php TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE available NUMERIC(20,2);
BEGIN
  IF p_beneficiary_id IS NULL OR p_attempt_id IS NULL OR
    p_amount_php IS NULL OR p_amount_php NOT IN ('5000.00', '3500.00') THEN
    RAISE EXCEPTION 'Invalid grant reservation' USING ERRCODE = '22023';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Grant funding requires READ COMMITTED' USING ERRCODE = '25000';
  END IF;
  -- A separate statement gives later reads a fresh snapshot after the lock wait.
  PERFORM pg_advisory_xact_lock(1111576148, 1);
  IF EXISTS (SELECT 1 FROM public.allocations WHERE beneficiary_id = p_beneficiary_id) OR
    EXISTS (SELECT 1 FROM public.fund_grant_reservations WHERE beneficiary_id = p_beneficiary_id AND status = 'ISSUED') THEN
    RETURN jsonb_build_object('outcome', 'issued');
  END IF;
  IF EXISTS (SELECT 1 FROM public.fund_grant_reservations WHERE beneficiary_id = p_beneficiary_id) THEN
    RETURN jsonb_build_object('outcome', 'busy');
  END IF;
  SELECT coalesce(sum(net_amount_php), 0) INTO available
    FROM public.fund_topups WHERE status = 'COMPLETED';
  SELECT available - coalesce(sum(amount_php), 0) INTO available
    FROM public.fund_grant_reservations;
  IF available < p_amount_php::numeric THEN
    RETURN jsonb_build_object('outcome', 'insufficient', 'availablePhp', available::text);
  END IF;
  INSERT INTO public.fund_grant_reservations(beneficiary_id, attempt_id, amount_php)
    VALUES (p_beneficiary_id, p_attempt_id, p_amount_php::numeric);
  RETURN jsonb_build_object('outcome', 'acquired');
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_grant_funding(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_grant_funding(UUID, UUID, TEXT) TO service_role;

CREATE FUNCTION public.mark_grant_funded(p_beneficiary_id UUID, p_attempt_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Grant funding requires READ COMMITTED' USING ERRCODE = '25000';
  END IF;
  PERFORM pg_advisory_xact_lock(1111576148, 1);
  UPDATE public.fund_grant_reservations r SET status = 'ISSUED'
    WHERE r.beneficiary_id = p_beneficiary_id AND r.attempt_id = p_attempt_id
      AND EXISTS (SELECT 1 FROM public.allocations a
        WHERE a.beneficiary_id = r.beneficiary_id AND a.amount_phpc = r.amount_php
          AND a.onchain_tx_hash IS NOT NULL AND a.onchain_tx_hash ~ '[^[:space:]]');
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_grant_funded(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_grant_funded(UUID, UUID) TO service_role;

CREATE OR REPLACE VIEW public.fund_ledger_summary WITH (security_invoker = true) AS
WITH contributions AS (
  SELECT coalesce(sum(amount_php), 0) AS gross, coalesce(sum(fee_php), 0) AS fees,
    coalesce(sum(net_amount_php), 0) AS net FROM public.fund_topups WHERE status = 'COMPLETED'
), grants AS (
  SELECT coalesce(sum(amount_phpc), 0) AS amount, count(*)::integer AS count
  FROM public.allocations WHERE onchain_tx_hash IS NOT NULL
), sales AS (
  SELECT coalesce(sum(total_amount), 0) AS amount FROM public.transactions
  WHERE status IN ('CONFIRMED', 'RECONCILED')
), invoices AS (
  SELECT coalesce(sum(total_amount_php), 0) AS amount FROM public.settlement_invoices WHERE status = 'PAID'
), backed AS (
  SELECT coalesce(sum(amount_php), 0) AS amount FROM public.fund_grant_reservations
)
SELECT contributions.gross::numeric(20,2)::text AS gross_contributions_php,
  contributions.fees::numeric(20,2)::text AS fees_php,
  contributions.net::numeric(20,2)::text AS net_contributions_php,
  grants.amount::numeric(20,2)::text AS grants_issued_php, grants.count AS grant_count,
  sales.amount::numeric(20,2)::text AS confirmed_sales_php,
  invoices.amount::numeric(20,2)::text AS paid_invoices_php,
  (sales.amount - invoices.amount)::numeric(20,2)::text AS owed_php,
  backed.amount::numeric(20,2)::text AS backed_grants_php,
  (contributions.net - backed.amount)::numeric(20,2)::text AS available_to_grant_php
FROM contributions CROSS JOIN grants CROSS JOIN sales CROSS JOIN invoices CROSS JOIN backed;
REVOKE ALL ON public.fund_ledger_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fund_ledger_summary TO service_role;
COMMIT;
