import { describe, expect, it, vi } from 'vitest'
import { ProductRepository } from './product.repository.js'

function createDb() {
  const variantMaybeSingle = vi.fn()
  const legacyMaybeSingle = vi.fn()
  const db = {
    from: vi.fn((table: string) => {
      if (table === 'product_variants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: variantMaybeSingle,
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: legacyMaybeSingle,
      }
    }),
  }
  return { db, variantMaybeSingle, legacyMaybeSingle }
}

describe('ProductRepository GTIN lookup', () => {
  it('looks up exact GTINs in product_variants', async () => {
    const { db, variantMaybeSingle, legacyMaybeSingle } = createDb()
    const variant = {
      id: 'variant-1',
      product_id: 'family-1',
      name: 'Alaska Fortified Powdered Milk Drink (33 g)',
      category: 'DAIRY',
      gtin: '4800575142633',
    }
    variantMaybeSingle.mockResolvedValue({ data: variant, error: null })

    const result = await new ProductRepository(db as never).findVariantByGtin('4800575142633')

    expect(result).toEqual(variant)
    expect(db.from).toHaveBeenCalledWith('product_variants')
    expect(legacyMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns null when the variant table is not deployed yet', async () => {
    const { db, variantMaybeSingle } = createDb()
    variantMaybeSingle.mockResolvedValue({ data: null, error: { code: '42P01', message: 'missing relation' } })

    await expect(new ProductRepository(db as never).findVariantByGtin('1234567890128')).resolves.toBeNull()
  })
})
