// BE1 owns this file. Requirements: PayPal settlement contract, section 5.
import { describe, expect, it, vi } from 'vitest'
import { ok, err } from '../lib/errors.js'
import { SettlementProposalService } from './settlement-proposal.service.js'

const sale = { id: 'sale', merchant_id: 'merchant', amount_php: '10.10', sold_at: '2026-11-12T00:00:00Z', ledger_tx_hash: 'hash', item_list_jsonb: [{ name: 'Rice', category: 'GRAINS', quantity: 1, unitPricePhp: 10.1 }] }

describe('Settlement proposal review', () => {
  it('rejects stored names over 200 characters before reading references or calling the model', async () => {
    const findReferencePrices = vi.fn().mockResolvedValue([])
    const model = vi.fn()
    const service = new SettlementProposalService({ findReferencePrices } as any, undefined, model)
    expect(await service.review([{ ...sale, item_list_jsonb: [{ name: 'x'.repeat(201), unitPricePhp: '10.10' }] }])).toMatchObject({ error: { _tag: 'validation' } })
    expect(findReferencePrices).not.toHaveBeenCalled()
    expect(model).not.toHaveBeenCalled()
  })
  it('rejects invalid stored prices before the model call', async () => {
    const model = vi.fn()
    const service = new SettlementProposalService({ findReferencePrices: vi.fn() } as any, undefined, model)
    expect(await service.review([{ ...sale, item_list_jsonb: [{ name: 'Rice', unitPricePhp: -1 }] }])).toMatchObject({ error: { _tag: 'validation' } })
    expect(model).not.toHaveBeenCalled()
  })
  it('uses the fallback after the model deadline', async () => {
    vi.useFakeTimers()
    try {
      const service = new SettlementProposalService({ findReferencePrices: vi.fn().mockResolvedValue([]) } as any,
        { searchMarketPrice: vi.fn().mockResolvedValue(ok(null)) } as any, vi.fn().mockReturnValue(new Promise(() => {})))
      const pending = service.review([sale])
      await vi.advanceTimersByTimeAsync(15000)
      expect(await pending).toMatchObject({ value: { held: [] } })
    } finally { vi.useRealTimers() }
  })
  it('uses the matching product price before market search', async () => {
    const search = vi.fn()
    const model = vi.fn().mockResolvedValue({ aiSummary: 'Review.', held: [] })
    const service = new SettlementProposalService({ findReferencePrices: vi.fn().mockResolvedValue([{ name: 'Rice', price_range_max: '10.00' }]) } as any, { searchMarketPrice: search } as any, model)
    const result = await service.review([sale])
    expect(result).toMatchObject({ value: { held: [{ transactionId: 'sale', reason: 'Rice exceeds its reference price.' }] } })
    expect(search).not.toHaveBeenCalled()
    expect(model.mock.calls[0][0].responseSchema).toBeDefined()
    expect(model.mock.calls[0][0].prompt).not.toContain('merchant_id')
  })
  it('uses market price when product is missing', async () => {
    const service = new SettlementProposalService({ findReferencePrices: vi.fn().mockResolvedValue([]) } as any,
      { searchMarketPrice: vi.fn().mockResolvedValue(ok({ price_max: 10 })) } as any,
      vi.fn().mockResolvedValue({ aiSummary: 'Review.', held: [] }))
    expect(await service.review([sale])).toMatchObject({ value: { held: [{ transactionId: 'sale', reason: 'Rice exceeds its reference price.' }] } })
  })
  it.each([ok(null), err(new Error('market failed'))])('continues with unknown references and Gemini failure', async marketResult => {
    const service = new SettlementProposalService({ findReferencePrices: vi.fn().mockResolvedValue([]) } as any,
      { searchMarketPrice: vi.fn().mockResolvedValue(marketResult) } as any,
      vi.fn().mockRejectedValue(new Error('model failed')))
    const result = await service.review([sale])
    expect(result.isOk()).toBe(true)
    expect(result).toMatchObject({ value: { held: [] } })
  })
  it('returns a safe persistence error for failed product reads', async () => {
    const service = new SettlementProposalService({ findReferencePrices: vi.fn().mockRejectedValue(new Error('private data')) } as any)
    const result = await service.review([sale])
    expect(result).toMatchObject({ error: { _tag: 'persistence' } })
    expect(JSON.stringify(result)).not.toContain('private data')
  })
})
