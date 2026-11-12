// BE1 owns this file. Requirements: PayPal settlement contract, sections 3, 5 and 9.
import { describe, expect, it, vi } from 'vitest'
import { SettlementSaleRepository } from './settlement-sale.repository.js'

function createDb(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }), in: vi.fn().mockResolvedValue({ data, error }),
  }
  const db = { from: vi.fn().mockReturnValue(query) }
  return { db, query, repository: new SettlementSaleRepository(db as never) }
}

describe('SettlementSaleRepository', () => {
  it('reads at most 100 eligible sales, oldest first, for one merchant', async () => {
    const sales = [{ id: 'sale', amount_php: '10.10' }]
    const { repository, db, query } = createDb(sales)
    expect(await repository.findEligible('merchant')).toEqual(sales)
    expect(db.from).toHaveBeenCalledWith('settlement_eligible_sales')
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant')
    expect(query.order.mock.calls).toEqual([['sold_at'], ['id']])
    expect(query.limit).toHaveBeenCalledWith(100)
  })
  it('uses exact product names to read reference prices', async () => {
    const prices = [{ name: 'Rice', price_range_max: '10.00' }]
    const { repository, db, query } = createDb(prices)
    expect(await repository.findReferencePrices(['Rice'])).toEqual(prices)
    expect(db.from).toHaveBeenCalledWith('products')
    expect(query.select).toHaveBeenCalledWith('name, price_range_max')
    expect(query.in).toHaveBeenCalledWith('name', ['Rice'])
  })
  it('returns empty arrays for missing data', async () => {
    const { repository } = createDb(null)
    expect(await repository.findEligible('merchant')).toEqual([])
    expect(await repository.findReferencePrices([])).toEqual([])
  })
  it('propagates read errors to the service', async () => {
    const error = { code: 'failed' }
    const { repository } = createDb(null, error)
    await expect(repository.findEligible('merchant')).rejects.toEqual(error)
    await expect(repository.findReferencePrices(['Rice'])).rejects.toEqual(error)
  })
})
