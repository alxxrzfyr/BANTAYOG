// BE1 owns this file. Requirements: PayPal settlement contract, section 6.
import { describe, expect, it } from 'vitest'
import { ApproveSettlementDto, RejectSettlementDto, SettlementMoneySchema, SettlementStatusSchema, SettlementListQuerySchema, SettlementLineDto, SettlementInvoiceDto } from './settlement.js'

describe('Settlement boundary schemas', () => {
  it('requires an explicit approval flag, including before a remote draft exists', () => {
    const invoice = { id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479', merchantId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479', storeName: 'Store',
      status: 'PROPOSED', totalAmountPhp: '10.10', heldAmountPhp: '0.00', aiSummary: 'Review.', paypalInvoiceId: null, payUrl: null,
      createdAt: '2026-11-12T00:00:00Z', sentAt: null, paidAt: null }
    expect(SettlementInvoiceDto.parse({ ...invoice, approved: true })).toHaveProperty('approved', true)
    expect(SettlementInvoiceDto.parse({ ...invoice, approved: false })).toHaveProperty('approved', false)
    expect(SettlementInvoiceDto.safeParse(invoice).success).toBe(false)
    expect(SettlementInvoiceDto.safeParse({ ...invoice, approved: 'true' }).success).toBe(false)
  })
  it('accepts PostgreSQL timestamps with a time-zone offset', () => {
    expect(SettlementLineDto.safeParse({ transactionId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      amountPhp: '10.10', soldAt: '2026-11-12T00:00:00+00:00', held: false, holdReason: null,
      ledgerTxHash: null, items: [],
    }).success).toBe(true)
  })
  it.each(['0.00', '0.10', '9999999999.99'])('accepts exact PHP %s', value => {
    expect(SettlementMoneySchema.safeParse(value).success).toBe(true)
  })
  it.each([1, '1', '1.1', '-1.00', '1.001', 'NaN', '01.00'])('rejects invalid PHP %s', value => {
    expect(SettlementMoneySchema.safeParse(value).success).toBe(false)
  })
  it('accepts only the four settlement states', () => {
    expect(SettlementStatusSchema.options).toEqual(['PROPOSED', 'SENT', 'PAID', 'CANCELLED'])
    expect(SettlementListQuerySchema.safeParse({ status: 'FAILED' }).success).toBe(false)
  })
  it('accepts an empty approval and rejects foreign fields, invalid and duplicate ids', () => {
    expect(ApproveSettlementDto.parse({})).toEqual({ releaseTransactionIds: [] })
    expect(ApproveSettlementDto.safeParse({ totalAmountPhp: '100.00' }).success).toBe(false)
    expect(ApproveSettlementDto.safeParse({ releaseTransactionIds: ['bad'] }).success).toBe(false)
    const id = 'a47ac10b-58cc-4372-a567-0e02b2c3d479'
    expect(ApproveSettlementDto.safeParse({ releaseTransactionIds: [id, id] }).success).toBe(false)
  })
  it('requires a nonempty rejection reason', () => {
    expect(RejectSettlementDto.safeParse({ reason: '  ' }).success).toBe(false)
    expect(RejectSettlementDto.parse({ reason: ' Price check ' })).toEqual({ reason: 'Price check' })
  })
})
