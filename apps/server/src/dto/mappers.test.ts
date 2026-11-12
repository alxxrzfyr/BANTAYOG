import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toBeneficiaryDTO,
  toMerchantDTO,
  toTransactionDTO,
  toClassificationDTO,
  toBalanceDTO
} from './mappers.js'
import { toSettlementInvoiceDTO, toMerchantSettlementOverviewDTO, toSettlementLineDTO, toFundTopupDTO } from './mappers.js'
import { SettlementInvoiceDto, MerchantSettlementOverviewDto, SettlementLineDto } from '@bantayog/schema'

it('maps a completed contribution with separate gross, fee and net amounts', () => {
  expect(toFundTopupDTO({
    id: 'f4ee46f7-d82e-4c9d-b1e3-febff1d73caf', amount_php: '50.00', status: 'COMPLETED',
    paypal_order_id: '5O190127TN364715T', paypal_capture_id: '3C679366HH908993F',
    fee_php: '16.70', net_amount_php: '33.30', created_at: '2026-11-12T00:00:00Z', completed_at: '2026-11-12T00:01:00Z',
  })).toMatchSnapshot()
})

it('maps settlement proof without private sale fields and fixes decimal strings', () => {
  const row = {
    id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479', merchant_id: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
    store_name: 'Test store', status: 'PROPOSED' as const, total_amount_php: '10.10', held_amount_php: '0.00',
    ai_summary: 'Review complete.', paypal_invoice_id: null, paypal_invoice_url: null, approved_by: null,
    created_at: '2026-11-12T00:00:00Z', sent_at: null, paid_at: null,
    lines: [{ id: 'line', invoice_id: 'invoice', transaction_id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
      amount_php: '10.10', sold_at: '2026-11-11T00:00:00Z', held: false, hold_reason: null, ledger_tx_hash: 'ledger-hash',
      item_list_jsonb: [{ name: 'Rice', category: 'GRAINS', quantity: 1, unitPricePhp: 10.1, imageUrl: null, pin: 'private' }],
      beneficiary: { child_name: 'private' },
    }],
  }
  const dto = toSettlementInvoiceDTO(row)
  expect(SettlementInvoiceDto.safeParse(dto).success).toBe(true)
  expect(dto).toMatchSnapshot()
  expect(dto).toHaveProperty('approved', false)
  expect(toSettlementInvoiceDTO({ ...row, approved_by: 'admin' })).toHaveProperty('approved', true)
  expect(JSON.stringify(dto)).not.toContain('private')
  const overview = toMerchantSettlementOverviewDTO({ merchant_id: row.merchant_id, unpaid_sale_count: 1,
    unpaid_amount_php: '10.10', waiting_for_ledger_count: 2, paid_amount_php: '0.00', invoices: [row] })
  expect(MerchantSettlementOverviewDto.safeParse(overview).success).toBe(true)
  expect(overview.invoices[0]).not.toHaveProperty('lines')
})

it.each([null, {}, [null, 42, 'bad', {}, { name: 'Rice', category: 'GRAINS', quantity: 1, unitPricePhp: 'invalid' },
  { name: 'Rice', category: null, quantity: 1, unitPricePhp: '10.10' },
  { name: 'Rice', category: 'GRAINS', quantity: 0, unitPricePhp: '10.10' }]])('skips malformed stored item fields without throwing: %j', items => {
  const line = { transaction_id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479', amount_php: '10.10', sold_at: '2026-11-12T00:00:00Z',
    held: false, hold_reason: null, ledger_tx_hash: null, item_list_jsonb: items } as any
  const dto = toSettlementLineDTO(line)
  expect(dto.items).toEqual([])
  expect(SettlementLineDto.safeParse(dto).success).toBe(true)
})

it('keeps valid sale items beside malformed stored items', () => {
  const dto = toSettlementLineDTO({ transaction_id: 'sale', amount_php: '10.10', sold_at: 'time', held: false,
    hold_reason: null, ledger_tx_hash: null, item_list_jsonb: [null,
      { name: 'Rice', category: 'GRAINS', quantity: 1, unitPricePhp: '10.105', imageUrl: null },
      { name: 'Milk', category: 'DAIRY', quantity: 2, unitPricePhp: -1 },
    ] } as any)
  expect(dto.items).toEqual([{ name: 'Rice', category: 'GRAINS', quantity: 1, unitPricePhp: '10.11', imageUrl: null }])
})

describe('DTO Mappers Snapshot Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should correctly map a beneficiary record', () => {
    const rawBeneficiary = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      guardian_name: 'Maria Santos',
      guardian_mobile_hash: 'hash123',
      child_name: 'Jose Santos',
      child_age_months: 6,
      monthly_income_php: 15000,
      gps_lat: 14.5995,
      gps_lng: 120.9842,
      eligibility_status: 'ELIGIBLE',
      credit_balance: 500.5,
      card_serial: 'BTY-12345678',
      activated_at: '2026-07-01T12:00:00.000Z',
      deactivated_at: null,
      created_at: '2026-07-01T12:00:00.000Z'
    }

    const mapped = toBeneficiaryDTO(rawBeneficiary)
    expect(mapped).toMatchSnapshot()
  })

  it('should correctly map a merchant record', () => {
    const rawMerchant = {
      id: 'e47ac10b-58cc-4372-a567-0e02b2c3d478',
      auth_user_id: 'a47ac10b-58cc-4372-a567-0e02b2c3d477',
      store_name: 'Santos Sari-Sari Store',
      owner_name: 'Pedro Santos',
      mobile_number_e164: '+639171234567',
      wallet_address: 'GANQ4X5FDIREJPH6LR5YCC5ODMSACA5T6Q54F7EF6BGO55M7R6AQIP52',
      wallet_balance: '190.00',
      status: 'APPROVED',
      created_at: '2026-07-01T12:00:00.000Z'
    }

    const mapped = toMerchantDTO(rawMerchant)
    expect(mapped).toMatchSnapshot()
  })

  it('should correctly map a transaction record', () => {
    const rawTransaction = {
      id: 'd47ac10b-58cc-4372-a567-0e02b2c3d476',
      beneficiary_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      merchant_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d478',
      item_list_jsonb: [
        {
          category: 'FRESH_MILK',
          name: 'Cowhead Milk 1L',
          quantity: 2,
          unitPricePhp: 95,
          creditCost: 190
        }
      ],
      total_credit_deducted: 190,
      stablecoin_amount_wei: '190000000000000000000',
      onchain_tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      idempotency_key: 'c47ac10b-58cc-4372-a567-0e02b2c3d475',
      status: 'CONFIRMED',
      created_at: '2026-07-01T12:00:00.000Z',
      confirmed_at: '2026-07-01T12:05:00.000Z'
    }

    const mapped = toTransactionDTO(rawTransaction)
    expect(mapped).toMatchSnapshot()
  })

  it('should correctly map a product classification result', () => {
    const rawResult = {
      identified: true,
      candidates: [
        {
          name: 'Gerber Baby Oatmeal',
          confidence: 0.95,
          product: {
            id: 'b47ac10b-58cc-4372-a567-0e02b2c3d474',
            name: 'Gerber Baby Oatmeal',
            eligibility_status: 'eligible',
            category: 'POWDERED_MILK'
          }
        }
      ]
    }

    const mapped = toClassificationDTO(rawResult)
    expect(mapped).toMatchSnapshot()
  })

  it('should correctly map a wallet balance result', () => {
    const rawBalance = {
      address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      balance: '10000000000000000000000',
      formatted: '10000.0'
    }

    const mapped = toBalanceDTO(rawBalance)
    expect(mapped).toMatchSnapshot()
  })
})
