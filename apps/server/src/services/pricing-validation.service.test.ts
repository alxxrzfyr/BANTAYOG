import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PricingValidationService } from './pricing-validation.service.js'

const mockCallGeminiWithFallback = vi.fn()
vi.mock('../lib/gemini-client.js', () => ({
  callGeminiWithFallback: (...args: any[]) => mockCallGeminiWithFallback(...args)
}))

// We'll also mock MarketPricesService
const mockSearchMarketPrice = vi.fn()
vi.mock('./market-prices.service.js', () => {
  return {
    MarketPricesService: vi.fn().mockImplementation(() => {
      return {
        searchMarketPrice: (...args: any[]) => mockSearchMarketPrice(...args)
      }
    })
  }
})

describe('PricingValidationService', () => {
  let service: PricingValidationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PricingValidationService()
  })

  it('fails fast if market price is not found in DA-AMAS static records', async () => {
    mockSearchMarketPrice.mockResolvedValueOnce({
      isOk: () => true,
      value: null
    })

    const result = await service.validateNonBranded('data:image/jpeg;base64,fake', 'Dragon Fruit', 200, 'per kilo')
    
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const data = result.value
      expect(data.isJustified).toBe(false)
      expect(data.isChildFriendly).toBe(false)
      expect(data.reasoning).toContain('not found in official DA-AMAS records')
      expect(data.mismatchReason).toContain('Commodity not recognized')
    }

    // Ensure Gemini is NOT called
    expect(mockCallGeminiWithFallback).not.toHaveBeenCalled()
  })

  it('proceeds with Gemini validation if market price is found', async () => {
    mockSearchMarketPrice.mockResolvedValueOnce({
      isOk: () => true,
      value: {
        commodity_name: 'Banana (Lakatan)',
        price_min: 70,
        price_max: 110,
        unit: 'per kilo',
        source: 'DA-AMAS',
        as_of_date: '2026-07-07'
      }
    })

    mockCallGeminiWithFallback.mockResolvedValueOnce({
      is_justified: true,
      is_child_friendly: true,
      reasoning: 'Valid banana price',
      flagged_ingredients: [],
      researched_price_min: 70,
      researched_price_max: 110,
      suggested_category: 'FRUITS',
      mismatch_reason: ''
    })

    const result = await service.validateNonBranded('data:image/jpeg;base64,fake', 'Banana (Lakatan)', 90, 'per kilo')
    
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const data = result.value
      expect(data.isJustified).toBe(true)
      expect(data.isChildFriendly).toBe(true)
    }

    // Ensure Gemini WAS called
    expect(mockCallGeminiWithFallback).toHaveBeenCalledTimes(1)
  })

  it('fails fast if price is severely below the DA-AMAS minimum (e.g. 1 peso)', async () => {
    mockSearchMarketPrice.mockResolvedValueOnce({
      isOk: () => true,
      value: {
        commodity_name: 'Banana (Lakatan)',
        price_min: 70,
        price_max: 110,
        unit: 'per kilo',
        source: 'DA-AMAS',
        as_of_date: '2026-07-07'
      }
    })

    const result = await service.validateNonBranded('data:image/jpeg;base64,fake', 'Banana (Lakatan)', 1, 'per kilo')
    
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const data = result.value
      expect(data.isJustified).toBe(false)
      expect(data.isChildFriendly).toBe(false)
      expect(data.reasoning).toContain('outside the allowed market range')
    }

    // Ensure Gemini is NOT called because of strict bounds
    expect(mockCallGeminiWithFallback).not.toHaveBeenCalled()
  })

  it('fails fast if price is severely above the DA-AMAS maximum', async () => {
    mockSearchMarketPrice.mockResolvedValueOnce({
      isOk: () => true,
      value: {
        commodity_name: 'Banana (Lakatan)',
        price_min: 70,
        price_max: 110,
        unit: 'per kilo',
        source: 'DA-AMAS',
        as_of_date: '2026-07-07'
      }
    })

    const result = await service.validateNonBranded('data:image/jpeg;base64,fake', 'Banana (Lakatan)', 200, 'per kilo')
    
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const data = result.value
      expect(data.isJustified).toBe(false)
      expect(data.isChildFriendly).toBe(false)
      expect(data.reasoning).toContain('outside the allowed market range')
    }

    // Ensure Gemini is NOT called because of strict bounds
    expect(mockCallGeminiWithFallback).not.toHaveBeenCalled()
  })
})
