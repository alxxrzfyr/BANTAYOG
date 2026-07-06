import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VisionService } from './vision.service.js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock the Gemini Client and GoogleGenAI
const mockCallGeminiWithFallback = vi.fn()
vi.mock('../lib/gemini-client.js', () => ({
  callGeminiWithFallback: (...args: any[]) => mockCallGeminiWithFallback(...args)
}))

// Mock GoogleGenAI for embeddings and simple calls
const mockEmbedContent = vi.fn()
const mockGenerateContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: mockEmbedContent,
      generateContent: mockGenerateContent
    }
  }))
}))

// Mock fetch for candidate images
global.fetch = vi.fn() as any

describe('VisionService - analyzeScan', () => {
  let dbMock: any
  let visionService: VisionService

  beforeEach(() => {
    vi.clearAllMocks()

    dbMock = {
      rpc: vi.fn(),
    } as any

    visionService = new VisionService(dbMock)
  })

  it('blurry status returns reasoning and short-circuits correctly', async () => {
    mockCallGeminiWithFallback.mockResolvedValueOnce({
      status: 'blurry',
      product_name: '',
      is_child_friendly: false,
      flagged_ingredients: [],
      reasoning: 'Photo is too blurry to analyze — please retake the picture'
    })

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')

    expect(result.isOk()).toBe(true)
    const val = result._unsafeUnwrap()
    expect(val.status).toBe('blurry')
    expect(val.reasoning).toBe('Photo is too blurry to analyze — please retake the picture')

    expect(mockCallGeminiWithFallback).toHaveBeenCalledTimes(1)
  })

  it('unrecognized status returns productName, isChildFriendly, reasoning and flaggedIngredients', async () => {
    mockCallGeminiWithFallback.mockResolvedValueOnce({
      status: 'unrecognized',
      product_name: 'Unknown Juice Drink',
      is_child_friendly: false,
      flagged_ingredients: ['High Sugar'],
      reasoning: 'Contains too much sugar for children.'
    })

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')

    expect(result.isOk()).toBe(true)
    const val = result._unsafeUnwrap()
    expect(val.status).toBe('unrecognized')
    expect(val.productName).toBe('Unknown Juice Drink')
    expect(val.isChildFriendly).toBe(false)
    expect(val.flaggedIngredients).toEqual(['High Sugar'])
    expect(val.reasoning).toBe('Contains too much sugar for children.')
  })

  it('identified status returns full product shape with calculated price range and category', async () => {
    mockCallGeminiWithFallback.mockResolvedValueOnce({
      status: 'identified',
      product_name: 'Dutch Mill Delight',
      is_child_friendly: true,
      flagged_ingredients: [],
      reasoning: 'Good source of active lactobacillus.',
      researched_base_price: 55,
      category: 'FRESH_MILK'
    })

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')

    expect(result.isOk()).toBe(true)
    const val = result._unsafeUnwrap()
    expect(val.status).toBe('identified')
    expect(val.productName).toBe('Dutch Mill Delight')
    expect(val.eligibilityStatus).toBe('eligible')
    expect(val.isChildFriendly).toBe(true)
    expect(val.priceRangeMin).toBe(45)
    expect(val.priceRangeMax).toBe(65)
    expect(val.category).toBe('FRESH_MILK')
    expect(val.flaggedIngredients).toEqual([])
  })

  it('handles rate limits (429) gracefully', async () => {
    mockCallGeminiWithFallback.mockRejectedValueOnce(new Error('API call failed: 429 RESOURCE_EXHAUSTED'))

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.message).toContain('rate_limit')
  })
})
