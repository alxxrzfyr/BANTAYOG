import { describe, it, expect } from 'vitest'
import { productRow } from '@repo/scripts/seed-product-mapping'

function row(overrides: Record<string, string> = {}) {
  return {
    gtin: '1234567890128', gtin_format: 'EAN-13', check_digit_valid: 'yes', brand: '', product_name: '', variant_size: '',
    net_weight_volume: '', packaging_type: '', manufacturer_distributor: '', country_of_origin: '',
    official_product_image_url: '', product_description: '', ingredients: '', allergen_info: '',
    nutrition_facts_link_or_summary: '', official_product_page_url: '', gs1_company_prefix: '',
    date_verified: '', primary_sources: '', verification_status: '', confidence_score: '',
    verification_notes: '',
    ...overrides,
  }
}

describe('productRow', () => {
  it('prepends the brand when the product name does not already include it', () => {
    const p = productRow(row({ brand: 'Alaska', product_name: 'Fortified Powdered Milk Drink', variant_size: '300 g' }), '1234567890128')
    expect(p?.name).toBe('Alaska Fortified Powdered Milk Drink (300 g)')
  })

  it('does not duplicate the brand when the product name already contains it', () => {
    const p = productRow(row({ brand: 'Alaska', product_name: 'Alaska Evaporada', variant_size: '370 ml' }), '1234567890128')
    expect(p?.name).toBe('Alaska Evaporada (370 ml)')
  })

  it('derives condensed-milk price_range_max from the matched min (never inverted)', () => {
    const big = productRow(row({ brand: 'Alaska', product_name: 'Evaporada Condensada', variant_size: '840 g' }), '1234567890128')
    const small = productRow(row({ brand: 'Bear Brand', product_name: 'Condensed Milk', variant_size: '300 g' }), '1234567890128')
    expect(big?.price_range_min).toBe(280)
    expect(big?.price_range_max).toBeGreaterThanOrEqual(big!.price_range_min)
    expect(small?.price_range_min).toBe(105)
    expect(small!.price_range_max).toBeGreaterThanOrEqual(small!.price_range_min)
  })
})
