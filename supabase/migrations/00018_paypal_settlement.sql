-- BE1 owns this file. Requirements: PayPal settlement contract, sections 3-6.
-- New settlement records only. This migration does not move credits or balances.
BEGIN;

CREATE TABLE IF NOT EXISTS public.settlement_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'SENT', 'PAID', 'CANCELLED')),
  total_amount_php NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount_php >= 0),
  ai_summary TEXT NOT NULL,
  paypal_invoice_id TEXT UNIQUE,
  paypal_invoice_url TEXT,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.settlement_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.settlement_invoices(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  amount_php NUMERIC(12,2) NOT NULL CHECK (amount_php >= 0),
  held BOOLEAN NOT NULL DEFAULT false,
  hold_reason TEXT,
  CONSTRAINT settlement_line_hold_reason CHECK (
    (held AND hold_reason IS NOT NULL AND length(btrim(hold_reason)) > 0) OR
    (NOT held AND hold_reason IS NULL)
  ),
  CONSTRAINT settlement_line_once_per_invoice UNIQUE (invoice_id, transaction_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS settlement_one_active_invoice
  ON public.settlement_invoices (merchant_id) WHERE status IN ('PROPOSED', 'SENT');
-- Keep this reservation after PAID. Only a hold or cancellation frees a sale.
CREATE UNIQUE INDEX IF NOT EXISTS settlement_one_claim_per_sale
  ON public.settlement_invoice_lines (transaction_id) WHERE held = false;
CREATE INDEX IF NOT EXISTS settlement_lines_invoice ON public.settlement_invoice_lines (invoice_id);

ALTER TABLE public.settlement_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_invoice_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.settlement_invoices, public.settlement_invoice_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_invoices, public.settlement_invoice_lines TO service_role;

-- Read projections keep every sum in SQL and emit exact decimal text.
CREATE OR REPLACE VIEW public.settlement_eligible_sales WITH (security_invoker = true) AS
SELECT t.id, t.merchant_id, t.total_amount::text AS amount_php,
       t.created_at AS sold_at, t.onchain_tx_hash AS ledger_tx_hash, t.item_list_jsonb
FROM public.transactions t
WHERE t.status IN ('CONFIRMED', 'RECONCILED')
  AND NOT EXISTS (SELECT 1 FROM public.settlement_invoice_lines l WHERE l.transaction_id = t.id AND l.held = false);

CREATE OR REPLACE VIEW public.settlement_invoice_summaries WITH (security_invoker = true) AS
SELECT i.id, i.merchant_id, m.store_name, i.status, i.total_amount_php::text AS total_amount_php,
       COALESCE((SELECT SUM(l.amount_php) FROM public.settlement_invoice_lines l WHERE l.invoice_id = i.id AND l.held), 0)::NUMERIC(12,2)::text AS held_amount_php,
       i.ai_summary, i.paypal_invoice_id, i.paypal_invoice_url, i.approved_by, i.created_at, i.sent_at, i.paid_at
FROM public.settlement_invoices i JOIN public.merchants m ON m.id = i.merchant_id;

CREATE OR REPLACE VIEW public.settlement_line_details WITH (security_invoker = true) AS
SELECT l.id, l.invoice_id, l.transaction_id, l.amount_php::text AS amount_php,
       l.held, l.hold_reason, t.created_at AS sold_at, t.onchain_tx_hash AS ledger_tx_hash, t.item_list_jsonb
FROM public.settlement_invoice_lines l JOIN public.transactions t ON t.id = l.transaction_id;

CREATE OR REPLACE VIEW public.settlement_merchant_overviews WITH (security_invoker = true) AS
SELECT m.id AS merchant_id,
       (SELECT count(*)::integer FROM public.settlement_eligible_sales s WHERE s.merchant_id = m.id) AS unpaid_sale_count,
       COALESCE((SELECT SUM(s.amount_php::numeric) FROM public.settlement_eligible_sales s WHERE s.merchant_id = m.id), 0)::numeric(12,2)::text AS unpaid_amount_php,
       (SELECT count(*)::integer FROM public.transactions t WHERE t.merchant_id = m.id AND t.status IN ('PENDING_CHAIN', 'SUBMITTED')) AS waiting_for_ledger_count,
       COALESCE((SELECT SUM(i.total_amount_php) FROM public.settlement_invoices i WHERE i.merchant_id = m.id AND i.status = 'PAID'), 0)::numeric(12,2)::text AS paid_amount_php
FROM public.merchants m;

REVOKE ALL ON public.settlement_eligible_sales, public.settlement_invoice_summaries,
  public.settlement_line_details, public.settlement_merchant_overviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.settlement_eligible_sales, public.settlement_invoice_summaries,
  public.settlement_line_details, public.settlement_merchant_overviews TO service_role;

-- p_sale_ids fixes the set that the server reviewed before the model call.
-- New sales wait for the next proposal. PayPal permits at most 100 invoice items.
CREATE OR REPLACE FUNCTION public.create_settlement_proposal(
  p_merchant_id UUID, p_held JSONB, p_ai_summary TEXT, p_sale_ids UUID[]
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice_id UUID;
  v_sale RECORD;
  v_reason TEXT;
  v_count INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_merchant_id::text, 18));
  SELECT id INTO v_invoice_id FROM public.settlement_invoices
    WHERE merchant_id = p_merchant_id AND status IN ('PROPOSED', 'SENT');
  IF FOUND THEN RETURN jsonb_build_object('id', v_invoice_id, 'created', false); END IF;
  IF p_sale_ids IS NULL OR cardinality(p_sale_ids) NOT BETWEEN 1 AND 100 OR
     p_held IS NULL OR jsonb_typeof(p_held) <> 'array' OR p_ai_summary IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid proposal input';
  END IF;
  INSERT INTO public.settlement_invoices (merchant_id, ai_summary)
    VALUES (p_merchant_id, p_ai_summary) RETURNING id INTO v_invoice_id;
  FOR v_sale IN
    SELECT t.id, t.total_amount FROM public.transactions t
    WHERE t.merchant_id = p_merchant_id AND t.id = ANY(p_sale_ids)
      AND t.status IN ('CONFIRMED', 'RECONCILED')
      AND NOT EXISTS (SELECT 1 FROM public.settlement_invoice_lines l WHERE l.transaction_id = t.id AND l.held = false)
    ORDER BY t.created_at, t.id FOR UPDATE OF t
  LOOP
    SELECT NULLIF(btrim(h->>'reason'), '') INTO v_reason FROM jsonb_array_elements(p_held) h
      WHERE h->>'transactionId' = v_sale.id::text LIMIT 1;
    INSERT INTO public.settlement_invoice_lines (invoice_id, transaction_id, amount_php, held, hold_reason)
      VALUES (v_invoice_id, v_sale.id, v_sale.total_amount, v_reason IS NOT NULL, v_reason);
    v_count := v_count + 1;
  END LOOP;
  IF v_count = 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No eligible sales'; END IF;
  UPDATE public.settlement_invoices SET total_amount_php =
    (SELECT COALESCE(SUM(amount_php), 0) FROM public.settlement_invoice_lines WHERE invoice_id = v_invoice_id AND held = false)
    WHERE id = v_invoice_id;
  RETURN jsonb_build_object('id', v_invoice_id, 'created', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_settlement(
  p_invoice_id UUID, p_admin_id UUID, p_release UUID[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice public.settlement_invoices%ROWTYPE;
  v_merchant_id UUID;
  v_total NUMERIC(12,2);
BEGIN
  SELECT merchant_id INTO v_merchant_id FROM public.settlement_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invoice not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_merchant_id::text, 18));
  SELECT * INTO v_invoice FROM public.settlement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.status = 'CANCELLED' THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invoice was cancelled'; END IF;
  IF p_admin_id IS NULL OR p_release IS NULL OR EXISTS (
    SELECT 1 FROM unnest(p_release) r WHERE NOT EXISTS (
      SELECT 1 FROM public.settlement_invoice_lines l WHERE l.invoice_id = p_invoice_id AND l.transaction_id = r
    )
  ) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid release selection'; END IF;
  -- The first approval fixes the payload before any remote side effect.
  IF v_invoice.approved_by IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.settlement_invoice_lines WHERE invoice_id = p_invoice_id AND transaction_id = ANY(p_release) AND held) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Approval is already fixed';
    END IF;
    RETURN p_invoice_id;
  END IF;
  IF v_invoice.status <> 'PROPOSED' THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invoice is not proposed'; END IF;
  -- A held sale may be reserved on another invoice after an earlier payment.
  IF EXISTS (
    SELECT 1 FROM public.settlement_invoice_lines l
    JOIN public.settlement_invoice_lines claimed ON claimed.transaction_id = l.transaction_id AND claimed.held = false AND claimed.invoice_id <> p_invoice_id
    WHERE l.invoice_id = p_invoice_id AND l.transaction_id = ANY(p_release)
  ) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Sale is already reserved'; END IF;
  UPDATE public.settlement_invoice_lines SET held = false, hold_reason = NULL
    WHERE invoice_id = p_invoice_id AND transaction_id = ANY(p_release);
  SELECT COALESCE(SUM(amount_php), 0) INTO v_total FROM public.settlement_invoice_lines WHERE invoice_id = p_invoice_id AND held = false;
  IF v_total <= 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Release a sale before approval'; END IF;
  UPDATE public.settlement_invoices SET total_amount_php = v_total, approved_by = p_admin_id WHERE id = p_invoice_id;
  RETURN p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_settlement(p_invoice_id UUID, p_reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice public.settlement_invoices%ROWTYPE;
  v_merchant_id UUID;
BEGIN
  SELECT merchant_id INTO v_merchant_id FROM public.settlement_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invoice not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_merchant_id::text, 18));
  SELECT * INTO v_invoice FROM public.settlement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.status = 'CANCELLED' THEN RETURN p_invoice_id; END IF;
  -- An approved draft can exist remotely even when a request times out.
  IF v_invoice.status <> 'PROPOSED' OR v_invoice.approved_by IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Approved or sent invoice cannot be rejected';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Reason is required';
  END IF;
  UPDATE public.settlement_invoice_lines SET held = true, hold_reason = p_reason WHERE invoice_id = p_invoice_id;
  UPDATE public.settlement_invoices SET status = 'CANCELLED', total_amount_php = 0 WHERE id = p_invoice_id;
  RETURN p_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_settlement_proposal(UUID, JSONB, TEXT, UUID[]),
  public.approve_settlement(UUID, UUID, UUID[]), public.cancel_settlement(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_settlement_proposal(UUID, JSONB, TEXT, UUID[]),
  public.approve_settlement(UUID, UUID, UUID[]), public.cancel_settlement(UUID, TEXT) TO service_role;
COMMIT;
