import { describe, it, expect, expectTypeOf } from 'vitest'
import { readFileSync } from 'node:fs'
import type {
  Database,
  TableName,
  MerchantRow,
  BeneficiaryRow,
  TransactionRow,
  OutboxRow,
  AllocationRow,
  MerchantWalletRow,
  MerchantStatus,
  EligibilityStatus,
  OutboxStatus,
  SettlementInvoiceRow,
  SettlementInvoiceLineRow,
} from './types.js'

describe('Database type structure', () => {
  it('mirrors funded grant rows, function arguments, outcomes and ledger strings', () => {
    type Reservation = Database['public']['Tables']['fund_grant_reservations']['Row']
    expectTypeOf<Reservation>().toEqualTypeOf<{
      beneficiary_id: string; attempt_id: string; amount_php: string | number;
      status: 'RESERVED' | 'ISSUED'; created_at: string
    }>()
    expectTypeOf<Database['public']['Functions']['reserve_grant_funding']>().toEqualTypeOf<{
      Args: { p_beneficiary_id: string; p_attempt_id: string; p_amount_php: string }
      Returns: { outcome: 'acquired' } | { outcome: 'busy' } | { outcome: 'issued' } |
        { outcome: 'insufficient'; availablePhp: string }
    }>()
    expectTypeOf<Database['public']['Functions']['mark_grant_funded']>().toEqualTypeOf<{
      Args: { p_beneficiary_id: string; p_attempt_id: string }; Returns: boolean
    }>()
    type Ledger = Database['public']['Views']['fund_ledger_summary']['Row']
    expectTypeOf<Ledger['backed_grants_php']>().toEqualTypeOf<string>()
    expectTypeOf<Ledger['available_to_grant_php']>().toEqualTypeOf<string>()
  })
  it('mirrors the service-only fund records and SQL functions', () => {
    type Topup = Database['public']['Tables']['fund_topups']['Row']
    expectTypeOf<Topup['status']>().toEqualTypeOf<'CREATED' | 'COMPLETED'>()
    expectTypeOf<Topup['amount_php']>().toEqualTypeOf<string>()
    expectTypeOf<Topup['fee_php']>().toEqualTypeOf<string | null>()
    expectTypeOf<Topup['net_amount_php']>().toEqualTypeOf<string | null>()
    expectTypeOf<Database['public']['Functions']['record_fund_capture']>().toEqualTypeOf<{
      Args: {
        p_id: string; p_order_id: string; p_capture_id: string;
        p_amount_php: string; p_fee_php: string; p_net_amount_php: string
      }
      Returns: string
    }>()
  })

  it('keeps the fund migration additive and service-only', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/00019_paypal_fund.sql', import.meta.url), 'utf8')
    expect(sql).toContain('CREATE TABLE public.fund_topups')
    expect(sql).toContain('CREATE VIEW public.fund_topup_details WITH (security_invoker = true)')
    expect(sql).toContain('CREATE VIEW public.fund_ledger_summary WITH (security_invoker = true)')
    expect(sql).toContain('CREATE FUNCTION public.record_fund_capture')
    expect(sql).toContain('paypal_capture_id TEXT UNIQUE')
    expect(sql).not.toMatch(/CREATE POLICY|UPDATE public\.(beneficiaries|merchants)|CREATE OR REPLACE/)
  })
  it('mirrors settlement tables and SQL-owned amounts', () => {
    expectTypeOf<SettlementInvoiceRow['status']>().toEqualTypeOf<'PROPOSED' | 'SENT' | 'PAID' | 'CANCELLED'>()
    expectTypeOf<SettlementInvoiceRow['total_amount_php']>().toEqualTypeOf<string | number>()
    expectTypeOf<SettlementInvoiceLineRow['amount_php']>().toEqualTypeOf<string | number>()
    expectTypeOf<Database['public']['Functions']['create_settlement_proposal']>().toEqualTypeOf<{
      Args: {
        p_merchant_id: string; p_held: { transactionId: string; reason: string }[];
        p_ai_summary: string; p_sale_ids: string[]
      }
      Returns: { id: string; created: boolean }
    }>()
  })

  it('has SQL duplicate guards, row locks, SQL totals, and service-only access', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/00018_paypal_settlement.sql', import.meta.url), 'utf8')
    expect(sql).toMatch(/UNIQUE INDEX[\s\S]*?ON public\.settlement_invoices\s*\(merchant_id\)[\s\S]*?WHERE status IN \('PROPOSED', 'SENT'\)/i)
    expect(sql).toMatch(/UNIQUE INDEX[\s\S]*?ON public\.settlement_invoice_lines\s*\(transaction_id\) WHERE held = false/i)
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('SUM(amount_php)')
    expect(sql).toContain('t.id = ANY(p_sale_ids)')
    expect(sql).toMatch(/settlement_invoices ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/settlement_invoice_lines ENABLE ROW LEVEL SECURITY/)
    expect(sql).not.toMatch(/CREATE POLICY|UPDATE public\.(merchants|beneficiaries)|CREATE OR REPLACE FUNCTION public\.settle_sale/)
    expect(sql).toContain('FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('TO service_role')
  })
  it('exposes the declared public tables', () => {
    expectTypeOf<TableName>().toEqualTypeOf<
      | 'administrators' | 'merchants' | 'beneficiaries' | 'transactions'
      | 'qr_passes' | 'outbox' | 'photo_receipts' | 'products' | 'product_variants'
      | 'beneficiary_wallets' | 'merchant_wallets' | 'allocations'
      | 'settlement_invoices' | 'settlement_invoice_lines'
      | 'fund_topups' | 'fund_grant_reservations'
    >()
  })
})

describe('Enum types', () => {
  it('limits merchant status to the supported values', () => {
    expectTypeOf<MerchantStatus>().toEqualTypeOf<'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'>()
  })

  it('limits eligibility status to the supported values', () => {
    expectTypeOf<EligibilityStatus>().toEqualTypeOf<'PENDING' | 'ELIGIBLE' | 'INELIGIBLE' | 'SUSPENDED'>()
  })

  it('limits outbox status to the supported values', () => {
    expectTypeOf<OutboxStatus>().toEqualTypeOf<'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'>()
  })
})

describe('Row type contracts', () => {
  it('allows a merchant without a wallet and keeps the balance numeric', () => {
    expectTypeOf<MerchantRow['wallet_address']>().toEqualTypeOf<string | null>()
    expectTypeOf<MerchantRow['wallet_balance']>().toEqualTypeOf<number>()
  })

  it('allows an unissued beneficiary pass and an unset PIN', () => {
    expectTypeOf<BeneficiaryRow['card_serial']>().toEqualTypeOf<string | null>()
    expectTypeOf<BeneficiaryRow['pin_hash_argon2id']>().toEqualTypeOf<string | null>()
    expectTypeOf<BeneficiaryRow['pin_salt']>().toEqualTypeOf<string | null>()
  })

  it('keeps transaction chain proof nullable until confirmation', () => {
    expectTypeOf<TransactionRow['asset_amount_stroops']>().toEqualTypeOf<string | null>()
    expectTypeOf<TransactionRow['onchain_tx_hash']>().toEqualTypeOf<string | null>()
    expectTypeOf<TransactionRow['ledger_sequence']>().toEqualTypeOf<number | null>()
    expectTypeOf<TransactionRow['confirmed_at']>().toEqualTypeOf<string | null>()
  })

  it('limits allocation tiers and permits legacy rows without ledger proof', () => {
    expectTypeOf<AllocationRow['tier']>().toEqualTypeOf<1 | 2>()
    expectTypeOf<AllocationRow['ledger_sequence']>().toEqualTypeOf<number | null>()
    expectTypeOf<AllocationRow['onchain_tx_hash']>().toEqualTypeOf<string | null>()
  })

  it('requires encrypted merchant wallet fields', () => {
    expectTypeOf<MerchantWalletRow>().toEqualTypeOf<{
      merchant_id: string; address: string; enc_ciphertext: string;
      enc_iv: string; enc_auth_tag: string; created_at: string
    }>()
  })

  it('keeps outbox payloads structured and completion optional', () => {
    expectTypeOf<OutboxRow['payload_jsonb']>().toEqualTypeOf<Record<string, unknown>>()
    expectTypeOf<OutboxRow['processed_at']>().toEqualTypeOf<string | null>()
  })
})
