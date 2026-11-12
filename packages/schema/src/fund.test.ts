import { describe, expect, it } from 'vitest'
import { CreateFundTopupDto, FundOrderParamsSchema } from './fund.js'

const id = 'f4ee46f7-d82e-4c9d-b1e3-febff1d73caf'
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
