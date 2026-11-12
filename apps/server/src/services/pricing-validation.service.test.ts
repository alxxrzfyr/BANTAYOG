import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, err } from 'neverthrow'
import { PricingValidationService } from './pricing-validation.service.js'

const mocks = vi.hoisted(() => ({ model: vi.fn(), search: vi.fn() }))
vi.mock('../lib/gemini-client.js', () => ({ callGeminiWithFallback: mocks.model }))
vi.mock('./market-prices.service.js', () => ({
  MarketPricesService: vi.fn().mockImplementation(() => ({ searchMarketPrice: mocks.search })),
}))
const banana = { commodity_name: 'Banana (Lakatan)', price_min: 70, price_max: 110,
  unit: 'per kilo', category: 'FRUITS', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' }
const imageReview = { image_matches: true, is_child_friendly: true,
  reasoning: 'The image shows a fresh banana.', flagged_ingredients: [],
  suggested_category: 'FRUITS', mismatch_reason: '' }

describe('PricingValidationService', () => {
  const service = new PricingValidationService()
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.search.mockResolvedValue(ok(banana))
    mocks.model.mockResolvedValue(imageReview)
  })

  it('accepts PHP 10 per piece at a measured 100g without changing the reference unit', async () => {
    const result = await service.validateNonBranded('data:image/png;base64,fake', 'Banana', 10, 'per piece', 100)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toMatchObject({ isJustified: true, isChildFriendly: true, priceStatus: 'valid',
        researchedPriceMin: 70, researchedPriceMax: 110, researchedPriceUnit: 'per kilo',
        referenceProductName: 'Banana (Lakatan)', referenceDate: '2026-07-07' })
      expect(result.value.priceReasoning).toContain('100 g')
    }
    expect(mocks.model.mock.calls[0][0].imageBase64).toBe('data:image/png;base64,fake')
  })

  it('requests weight without calling the banana unhealthy', async () => {
    const result = await service.validateNonBranded('fake', 'Banana', 10, 'per piece')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toMatchObject({ isJustified: false, isChildFriendly: true,
        priceStatus: 'needs_weight', researchedPriceUnit: 'per kilo' })
      expect(result.value.priceReasoning).toContain('weight')
      expect(result.value.reasoning).toBe(imageReview.reasoning)
    }
    expect(mocks.model).toHaveBeenCalledOnce()
  })

  it.each([[10, 'per 100g', true], [90, 'per kilo', true], [56, 'per kilo', true],
    [132, 'per kilo', true], [55.99, 'per kilo', false], [132.01, 'per kilo', false],
    [1, 'per kilo', false], [200, 'per kilo', false]] as const)(
    'checks PHP %s %s against exact tolerance boundaries', async (price, unit, accepted) => {
      const result = await service.validateNonBranded('fake', 'Banana', price, unit)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.isJustified).toBe(accepted)
        expect(result.value.isChildFriendly).toBe(true)
        expect(result.value.priceStatus).toBe(accepted ? 'valid' : 'out_of_range')
        expect(result.value.priceReasoning).toContain(unit)
      }
    })

  it('checks a dozen eggs against a per-piece reference without weight', async () => {
    mocks.search.mockResolvedValue(ok({ ...banana, commodity_name: 'Chicken Egg', unit: 'per piece', price_min: 7, price_max: 10 }))
    const result = await service.validateNonBranded('fake', 'Chicken Egg', 100, 'per dozen')
    expect(result.isOk() && result.value.isJustified).toBe(true)
  })

  it('does not compare liters with kilos', async () => {
    const result = await service.validateNonBranded('fake', 'Banana', 90, 'per liter')
    expect(result.isOk() && result.value.priceStatus).toBe('unsupported_unit')
    expect(result.isOk() && result.value.isJustified).toBe(false)
  })

  it('keeps a missing reference distinct from nutrition rejection', async () => {
    mocks.search.mockResolvedValue(ok(null))
    const result = await service.validateNonBranded('fake', 'Dragon Fruit', 90, 'per kilo')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toMatchObject({ isJustified: false, isChildFriendly: true,
      priceStatus: 'no_reference', researchedPriceMin: null, researchedPriceMax: null, researchedPriceUnit: null })
  })

  it('returns a safe reference error before AI if the lookup fails', async () => {
    mocks.search.mockResolvedValue(err(new Error('private reference details')))
    const result = await service.validateNonBranded('fake', 'Banana', 90, 'per kilo')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toBe('Price reference lookup failed. Please try again.')
    expect(mocks.model).not.toHaveBeenCalled()
  })

  it('does not let AI replace reference prices or approve a rejected price', async () => {
    mocks.model.mockResolvedValue({ ...imageReview, is_justified: true, researched_price_min: 0, researched_price_max: 10000 })
    const result = await service.validateNonBranded('fake', 'Banana', 200, 'per kilo')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toMatchObject({ isJustified: false, researchedPriceMin: 70, researchedPriceMax: 110 })
    expect(mocks.model.mock.calls[0][0].prompt).not.toContain('₱')
  })

  it('keeps image mismatch and nutrition concerns separate from price', async () => {
    mocks.model.mockResolvedValue({ ...imageReview, image_matches: false, mismatch_reason: 'The image shows an onion.' })
    const mismatch = await service.validateNonBranded('fake', 'Banana', 90, 'per kilo')
    expect(mismatch.isOk() && mismatch.value.isJustified).toBe(false)
    expect(mismatch.isOk() && mismatch.value.mismatchReason).toBe('The image shows an onion.')
    mocks.model.mockResolvedValue({ ...imageReview, is_child_friendly: false, flagged_ingredients: ['Added sugar'] })
    const nutrition = await service.validateNonBranded('fake', 'Banana', 90, 'per kilo')
    expect(nutrition.isOk() && nutrition.value.isChildFriendly).toBe(false)
    expect(nutrition.isOk() && nutrition.value.priceStatus).toBe('valid')
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 10.001])('rejects invalid price %s before AI', async price => {
    expect((await service.validateNonBranded('fake', 'Banana', price, 'per kilo')).isErr()).toBe(true)
    expect(mocks.model).not.toHaveBeenCalled()
  })

  it.each([0, -1, 0.1, Number.POSITIVE_INFINITY])('rejects invalid unit weight %s', async weight => {
    expect((await service.validateNonBranded('fake', 'Banana', 10, 'per piece', weight)).isErr()).toBe(true)
  })

  it('rejects unsupported units, blank names, and empty images', async () => {
    for (const [image, name, unit] of [['fake', 'Banana', 'per truck'], ['fake', ' ', 'per kilo'], ['', 'Banana', 'per kilo']]) {
      expect((await service.validateNonBranded(image, name, 10, unit)).isErr()).toBe(true)
    }
    expect(mocks.model).not.toHaveBeenCalled()
  })

  it('rejects malformed AI booleans', async () => {
    mocks.model.mockResolvedValue({ ...imageReview, is_child_friendly: 'false' })
    expect((await service.validateNonBranded('fake', 'Banana', 90, 'per kilo')).isErr()).toBe(true)
  })

  it.each(['429 secret-api-key', '400 secret-api-key', 'Unexpected secret-api-key'])('returns a safe error for %s', async message => {
    mocks.model.mockRejectedValue(new Error(message))
    const result = await service.validateNonBranded('fake', 'Banana', 90, 'per kilo')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).not.toContain('secret-api-key')
  })
})
