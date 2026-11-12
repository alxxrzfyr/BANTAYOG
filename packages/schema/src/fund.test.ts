import { describe, expect, it } from 'vitest'
import { CreateFundTopupDto, FundOrderParamsSchema, FundLedgerDto } from './fund.js'

const id = 'f4ee46f7-d82e-4c9d-b1e3-febff1d73caf'
const ledger = { grossContributionsPhp: '5016.95', feesPhp: '16.95', netContributionsPhp: '5000.00',
  grantsIssuedPhp: '8500.00', grantCount: 2, confirmedSalesPhp: '125.50', paidInvoicesPhp: '100.00',
  owedPhp: '25.50', backedGrantsPhp: '5000.00', availableToGrantPhp: '0.00', topups: [] }
describe('Sandbox contributions', () => {
  it.each(['1.00', '50.01', '100000.00'])('accepts exact PHP %s', amountPhp => {
    expect(CreateFundTopupDto.safeParse({ requestId: id, amountPhp }).success).toBe(true)
  })
  it.each(['0.00', '0.99', '100000.01', '-1.00', '01.00', '1', '1.001', '1e3', 50])('rejects invalid amount %s', amountPhp => {
    expect(CreateFundTopupDto.safeParse({ requestId: id, amountPhp }).success).toBe(false)
  })
  it('rejects extra currency and return URL fields and invalid IDs', () => {
    expect(CreateFundTopupDto.safeParse({ requestId: id, amountPhp: '50.00', currency: 'USD' }).success).toBe(false)
    expect(CreateFundTopupDto.safeParse({ requestId: id, amountPhp: '50.00', returnUrl: 'https://evil.test' }).success).toBe(false)
    expect(CreateFundTopupDto.safeParse({ requestId: 'bad', amountPhp: '50.00' }).success).toBe(false)
    expect(FundOrderParamsSchema.safeParse({ orderId: '5O190127TN364715T' }).success).toBe(true)
    expect(FundOrderParamsSchema.safeParse({ orderId: '../capture' }).success).toBe(false)
  })
})

describe('funded grant ledger contract', () => {
  it('keeps the two required SQL-owned fund amounts as decimal strings', () => {
    expect(FundLedgerDto.parse(ledger)).toEqual(ledger)
  })
  it.each(['backedGrantsPhp', 'availableToGrantPhp'] as const)('requires %s', field => {
    const without = { ...ledger, [field]: undefined }
    expect(FundLedgerDto.safeParse(without).success).toBe(false)
  })
  it.each(['backedGrantsPhp', 'availableToGrantPhp'] as const)('rejects malformed %s', field => {
    for (const amount of [null, 5000, '', '-1.00', '01.00', '1', '1.001', '1e3']) {
      expect(FundLedgerDto.safeParse({ ...ledger, [field]: amount }).success).toBe(false)
    }
  })
})
