import { describe, expect, it, vi } from 'vitest'
import { ProductsService } from './products.service.js'

const variant = {
  id: 'variant-1',
  product_id: 'family-1',
  sku: 'ALASKA-33G',
  brand: 'Alaska',
  name: 'Alaska Fortified Powdered Milk Drink (33 g)',
  net_content: '33 g',
  flavour: null,
  packaging_type: 'Sachet',
  category: 'DAIRY',
  image_url: null,
  gtin: '4800575142633',
  eligibility_status: 'eligible',
  price_range_min: 35,
  price_range_max: 80,
}

function createDb() {
  return {
    from: vi.fn(),
  }
}

describe('ProductsService.validateByGtin', () => {
  it('returns variant and family identifiers for an exact SKU match', async () => {
    const db = createDb()
    const service = new ProductsService(db as never)
    const repo = (service as unknown as { productRepo: { findVariantByGtin: ReturnType<typeof vi.fn>; findByGtin: ReturnType<typeof vi.fn> } }).productRepo
    repo.findVariantByGtin = vi.fn().mockResolvedValue(variant)
    repo.findByGtin = vi.fn()

    const result = await service.validateByGtin('4800575142633')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        matched: true,
        product: {
          id: 'variant-1',
          variant_id: 'variant-1',
          family_id: 'family-1',
          sku: 'ALASKA-33G',
          brand: 'Alaska',
          net_content: '33 g',
          packaging_type: 'Sachet',
          category: 'DAIRY',
          gtin: '4800575142633',
        },
      })
    }
    expect(repo.findByGtin).not.toHaveBeenCalled()
  })

  it('falls back to the legacy products row when no variant exists', async () => {
    const db = createDb()
    const service = new ProductsService(db as never)
    const repo = (service as unknown as { productRepo: { findVariantByGtin: ReturnType<typeof vi.fn>; findByGtin: ReturnType<typeof vi.fn> } }).productRepo
    repo.findVariantByGtin = vi.fn().mockResolvedValue(null)
    repo.findByGtin = vi.fn().mockResolvedValue({
      id: 'legacy-1',
      name: 'Legacy Milk',
      category: 'DAIRY',
      eligibility_status: 'eligible',
      price_range_min: 10,
      price_range_max: 20,
      image_url: null,
      gtin: '1234567890128',
    })

    const result = await service.validateByGtin('1234567890128')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        matched: true,
        product: {
          id: 'legacy-1',
          name: 'Legacy Milk',
          gtin: '1234567890128',
        },
      })
      expect(result.value.matched && result.value.product.variant_id).toBeUndefined()
    }
  })
})
