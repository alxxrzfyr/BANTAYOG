// BE1 owns this file. Requirements: PayPal settlement contract, section 5.
import { describe, expect, it } from 'vitest'
import { decideSettlementHolds, SETTLEMENT_FALLBACK_SUMMARY } from './settlement.js'
import { formatPhp, isPriceAbove } from './php-money.js'

const sales = [
  { id: 'sale-1', items: [{ name: 'Rice', unitPricePhp: '50.01', referencePricePhp: '50.00' }] },
  { id: 'sale-2', items: [{ name: 'Unknown', unitPricePhp: '10.10', referencePricePhp: null }] },
  { id: 'sale-3', items: [{ name: 'Milk', unitPricePhp: '20.00', referencePricePhp: '20.00' }] },
]

describe('Settlement price decisions', () => {
  it('holds an item above reference, keeps equal prices, and uses fixed fallback text', () => {
    const result = decideSettlementHolds(sales, undefined)
    expect(result.aiSummary).toBe(SETTLEMENT_FALLBACK_SUMMARY)
    expect(result.held).toEqual([{ transactionId: 'sale-1', reason: 'Rice exceeds its reference price.' }])
  })
  it('accepts model reasons, but never adds sales, changes amounts, releases a hold, or holds a known fair price', () => {
    const result = decideSettlementHolds(sales, {
      aiSummary: 'Review these prices.', totalAmountPhp: '999999.00',
      held: [
        { transactionId: 'foreign', reason: 'Injected sale', amountPhp: '999.00' },
        { transactionId: 'sale-2', reason: 'Price needs review.' },
        { transactionId: 'sale-2', reason: 'Duplicate reason.' },
        { transactionId: 'sale-3', reason: 'Try to remove a valid sale.' },
      ],
    })
    expect(result).toEqual({ aiSummary: 'Review these prices.', held: [
      { transactionId: 'sale-1', reason: 'Rice exceeds its reference price.' },
      { transactionId: 'sale-2', reason: 'Price needs review.' },
    ] })
    expect(sales[0].items[0].unitPricePhp).toBe('50.01')
  })
  it.each([null, {}, { aiSummary: 5, held: [] }, { aiSummary: 'x', held: [{ transactionId: 'sale-1', reason: '' }] }])('falls back on malformed model output', model => {
    expect(decideSettlementHolds(sales, model).aiSummary).toBe(SETTLEMENT_FALLBACK_SUMMARY)
  })
  it('allows a model explanation for an enforced hold', () => {
    expect(decideSettlementHolds(sales, { aiSummary: 'Check.', held: [{ transactionId: 'sale-1', reason: 'Rice is too expensive.' }] }).held[0].reason).toBe('Rice is too expensive.')
  })
  it('compares prices before display rounding and formats with integer arithmetic', () => {
    expect(isPriceAbove('50.001', '50.00')).toBe(true)
    expect(isPriceAbove('9999999999.99', '9999999999.98')).toBe(true)
    expect(formatPhp('9999999999.995')).toBe('10000000000.00')
    expect(formatPhp(10.1)).toBe('10.10')
    expect(() => formatPhp('invalid')).toThrow('Invalid stored PHP amount')
  })
})
