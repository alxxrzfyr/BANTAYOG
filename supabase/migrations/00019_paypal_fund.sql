-- BE1 owns this file. Requirements: PayPal fund contract. Sandbox only.
-- Additive records only. No credit, merchant balance or existing policy changes.
BEGIN;

CREATE TABLE public.fund_topups (
  id UUID PRIMARY KEY,
  amount_php NUMERIC(12,2) NOT NULL CHECK (amount_php BETWEEN 1.00 AND 100000.00),
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'COMPLETED')),
  paypal_order_id TEXT UNIQUE CHECK (paypal_order_id ~ '^[A-Z0-9]{17}$'),
  paypal_capture_id TEXT UNIQUE CHECK (paypal_capture_id ~ '^[A-Z0-9]{17}$'),
  fee_php NUMERIC(12,2) CHECK (fee_php >= 0),
  net_amount_php NUMERIC(12,2) CHECK (net_amount_php >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK ((status = 'CREATED' AND paypal_capture_id IS NULL AND fee_php IS NULL
    AND net_amount_php IS NULL AND completed_at IS NULL) OR
    (status = 'COMPLETED' AND paypal_order_id IS NOT NULL AND paypal_capture_id IS NOT NULL
    AND fee_php IS NOT NULL AND net_amount_php IS NOT NULL AND completed_at IS NOT NULL
    AND amount_php = fee_php + net_amount_php))
);
ALTER TABLE public.fund_topups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_topups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fund_topups TO service_role;

CREATE VIEW public.fund_topup_details WITH (security_invoker = true) AS
SELECT id, amount_php::text, status, paypal_order_id, paypal_capture_id,
  fee_php::text, net_amount_php::text, created_at, completed_at
FROM public.fund_topups;

CREATE VIEW public.fund_ledger_summary WITH (security_invoker = true) AS
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
)
SELECT contributions.gross::numeric(20,2)::text AS gross_contributions_php,
  contributions.fees::numeric(20,2)::text AS fees_php,
  contributions.net::numeric(20,2)::text AS net_contributions_php,
  grants.amount::numeric(20,2)::text AS grants_issued_php, grants.count AS grant_count,
  sales.amount::numeric(20,2)::text AS confirmed_sales_php,
  invoices.amount::numeric(20,2)::text AS paid_invoices_php,
  (sales.amount - invoices.amount)::numeric(20,2)::text AS owed_php
FROM contributions CROSS JOIN grants CROSS JOIN sales CROSS JOIN invoices;

REVOKE ALL ON public.fund_topup_details, public.fund_ledger_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fund_topup_details, public.fund_ledger_summary TO service_role;

CREATE FUNCTION public.create_fund_topup(p_id UUID, p_amount_php TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saved public.fund_topups%ROWTYPE; amount NUMERIC(12,2);
BEGIN
  IF p_amount_php IS NULL OR p_amount_php !~ '^(0|[1-9][0-9]{0,5})\.[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid contribution amount' USING ERRCODE = '22023';
  END IF;
  amount := p_amount_php::numeric;
  IF amount < 1.00 OR amount > 100000.00 THEN
    RAISE EXCEPTION 'Contribution amount is outside the limit' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fund_topups(id, amount_php) VALUES (p_id, amount) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO STRICT saved FROM public.fund_topups WHERE id = p_id FOR UPDATE;
  IF saved.amount_php <> amount THEN
    RAISE EXCEPTION 'The request ID already has a different amount' USING ERRCODE = '22023';
  END IF;
  RETURN p_id;
END;
$$;

CREATE FUNCTION public.record_fund_capture(p_id UUID, p_order_id TEXT, p_capture_id TEXT,
  p_amount_php TEXT, p_fee_php TEXT, p_net_amount_php TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saved public.fund_topups%ROWTYPE; gross NUMERIC(12,2); fee NUMERIC(12,2); net NUMERIC(12,2);
BEGIN
  IF p_order_id IS NULL OR p_order_id !~ '^[A-Z0-9]{17}$' OR
    p_capture_id IS NULL OR p_capture_id !~ '^[A-Z0-9]{17}$' OR
    p_amount_php IS NULL OR p_amount_php !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR
    p_fee_php IS NULL OR p_fee_php !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR
    p_net_amount_php IS NULL OR p_net_amount_php !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid capture proof' USING ERRCODE = '22023';
  END IF;
  gross := p_amount_php::numeric; fee := p_fee_php::numeric; net := p_net_amount_php::numeric;
  SELECT * INTO saved FROM public.fund_topups WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR saved.paypal_order_id IS DISTINCT FROM p_order_id OR saved.amount_php <> gross OR gross <> fee + net THEN
    RAISE EXCEPTION 'Capture proof does not match the contribution' USING ERRCODE = '22023';
  END IF;
  IF saved.status = 'COMPLETED' THEN
    IF saved.paypal_capture_id IS DISTINCT FROM p_capture_id OR saved.fee_php <> fee OR saved.net_amount_php <> net THEN
      RAISE EXCEPTION 'The contribution already has different capture proof' USING ERRCODE = '22023';
    END IF;
    RETURN p_id;
  END IF;
  UPDATE public.fund_topups SET status = 'COMPLETED', paypal_capture_id = p_capture_id,
    fee_php = fee, net_amount_php = net, completed_at = now() WHERE id = p_id;
  RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_fund_topup(UUID, TEXT),
  public.record_fund_capture(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_fund_topup(UUID, TEXT),
  public.record_fund_capture(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
COMMIT;
