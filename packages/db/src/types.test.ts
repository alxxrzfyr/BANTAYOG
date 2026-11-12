import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Database, SettlementInvoiceRow, SettlementInvoiceLineRow } from './types.js'
import type {
  TableName,
  MerchantRow,
  BeneficiaryRow,
  TransactionRow,
  OutboxRow,
  AllocationRow,
  MerchantWalletRow,
  MerchantStatus,
  EligibilityStatus,
  TransactionStatus,
  OutboxStatus,
} from './types.js'

describe('Database type structure', () => {
  it('mirrors settlement tables and SQL-owned amounts', () => {
    const invoice: SettlementInvoiceRow = {
      id: 'invoice', merchant_id: 'merchant', status: 'PROPOSED', total_amount_php: '10.10',
      ai_summary: 'Review complete.', paypal_invoice_id: null, paypal_invoice_url: null,
      approved_by: null, created_at: '2026-11-12T00:00:00Z', sent_at: null, paid_at: null,
    }
    const line: SettlementInvoiceLineRow = {
      id: 'line', invoice_id: invoice.id, transaction_id: 'sale', amount_php: '10.10', held: false, hold_reason: null,
    }
    const tables: TableName[] = ['settlement_invoices', 'settlement_invoice_lines']
    const args: Database['public']['Functions']['create_settlement_proposal']['Args'] = {
      p_merchant_id: 'merchant', p_held: [], p_ai_summary: 'Review complete.', p_sale_ids: ['sale'],
    }
    expect(tables).toHaveLength(2)
    expect(line.amount_php).toBe(invoice.total_amount_php)
    expect(args.p_sale_ids).toEqual(['sale'])
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
  it('has all catalog tables in the public schema', () => {
    // Type-level test: if this compiles, the types are correct
    const expectedTables: TableName[] = [
      'administrators',
      'merchants',
      'beneficiaries',
      'transactions',
      'qr_passes',
      'outbox',
      'photo_receipts',
      'products',
      'product_variants',
    ]
    // Runtime check that we listed the catalog tables too.
    expect(expectedTables).toContain('products')
    expect(expectedTables).toContain('product_variants')
  })
})

describe('Enum types', () => {
  it('MerchantStatus has 4 values', () => {
    const valid: MerchantStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']
    expect(valid).toHaveLength(4)
  })

  it('EligibilityStatus has 4 values', () => {
    const valid: EligibilityStatus[] = ['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'SUSPENDED']
    expect(valid).toHaveLength(4)
  })

  it('TransactionStatus has 6 lifecycle states', () => {
    const valid: TransactionStatus[] = [
      'PENDING_CHAIN',
      'CONFIRMED',
      'DB_RECORDED',
      'BROADCAST',
      'RECONCILED',
      'FAILED',
    ]
    expect(valid).toHaveLength(6)
  })

  it('OutboxStatus has 4 values', () => {
    const valid: OutboxStatus[] = ['PENDING', 'PROCESSING', 'DONE', 'FAILED']
    expect(valid).toHaveLength(4)
  })
})

describe('Row types compile-check', () => {
  it('MerchantRow has required fields', () => {
    const row: MerchantRow = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      auth_user_id: 'a47ac10b-58cc-4372-a567-0e02b2c3d480',
      store_name: 'Test Store',
      owner_name: 'Test Owner',
      mobile_number_e164: '+639171234567',
      wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
      wallet_balance: 0,
      cashout_in_progress: false,
      status: 'PENDING',
      created_at: '2026-06-29T00:00:00Z',
    }
    expect(row.id).toBeDefined()
  })

  it('BeneficiaryRow has required fields', () => {
    const row: BeneficiaryRow = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      guardian_name: 'Maria Santos',
      guardian_mobile_hash: 'sha256:abc',
      child_name: 'Baby Santos',
      child_age_months: 12,
      monthly_income_php: 8000,
      gps_lat: 14.5995,
      gps_lng: 120.9842,
      pin_hash_argon2id: null,
      pin_salt: null,
      eligibility_status: 'PENDING',
      credit_balance: 0,
      card_serial: null,
      activated_at: null,
      deactivated_at: null,
      created_at: '2026-06-29T00:00:00Z',
    }
    expect(row.id).toBeDefined()
  })

  it('TransactionRow has required fields', () => {
    const row: TransactionRow = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      beneficiary_id: 'a47ac10b-58cc-4372-a567-0e02b2c3d480',
      merchant_id: 'b47ac10b-58cc-4372-a567-0e02b2c3d481',
      item_list_jsonb: [],
      total_credit_deducted: 0,
      stablecoin_amount_wei: '0',
      asset_amount_stroops: null,
      onchain_tx_hash: null,
      ledger_sequence: null,
      idempotency_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      status: 'PENDING_CHAIN',
      created_at: '2026-06-29T00:00:00Z',
      confirmed_at: null,
    }
    expect(row.id).toBeDefined()
  })

  it('AllocationRow has required fields including ledger_sequence (migration 00012, F7)', () => {
    const row: AllocationRow = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      beneficiary_id: 'a47ac10b-58cc-4372-a567-0e02b2c3d480',
      tier: 1,
      amount_phpc: 5000,
      onchain_tx_hash: 'stellarhash123',
      ledger_sequence: 42,
      reconciled: false,
      allocated_at: '2026-06-29T00:00:00Z',
    }
    expect(row.ledger_sequence).toBe(42)
  })

  it('AllocationRow allows ledger_sequence to be null (legacy rows predating migration 00012)', () => {
    const row: AllocationRow = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      beneficiary_id: 'a47ac10b-58cc-4372-a567-0e02b2c3d480',
      tier: 2,
      amount_phpc: 3500,
      onchain_tx_hash: null,
      ledger_sequence: null,
      reconciled: false,
      allocated_at: '2026-06-29T00:00:00Z',
    }
    expect(row.ledger_sequence).toBeNull()
  })

  it('MerchantWalletRow has required fields (migration 00011)', () => {
    const row: MerchantWalletRow = {
      merchant_id: 'b47ac10b-58cc-4372-a567-0e02b2c3d481',
      address: 'GANQ4X5FDIREJPH6LR5YCC5ODMSACA5T6Q54F7EF6BGO55M7R6AQIP52',
      enc_ciphertext: 'ciphertext',
      enc_iv: 'iv',
      enc_auth_tag: 'authtag',
      created_at: '2026-06-29T00:00:00Z',
    }
    expect(row.address).toMatch(/^[GC][A-Z2-7]{55}$/)
  })

  it('OutboxRow has required fields', () => {
    const row: OutboxRow = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      kind: 'CALL_SUBSIDY_CONTRACT',
      payload_jsonb: {},
      status: 'PENDING',
      attempts: 0,
      run_after: '2026-06-29T00:00:00Z',
      created_at: '2026-06-29T00:00:00Z',
      processed_at: null,
    }
    expect(row.id).toBeDefined()
  })
})
