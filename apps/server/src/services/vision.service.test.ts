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

  it('Step 0 DB fast-path: confirmed match returns DB-sourced values without calling the fallback pipeline', async () => {
    // 1. Mock embedding
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [0.1, 0.2, 0.3] }]
    })

    // 2. Mock DB RPC returning candidates
    dbMock.rpc.mockResolvedValueOnce({
      data: [{
        id: '123',
        name: 'Dutch Mill Delight',
        eligibility_status: 'eligible',
        price_range_min: 50,
        price_range_max: 60,
        reference_image_url: 'http://example.com/image.jpg'
      }],
      error: null
    })

    // 3. Mock fetch candidate image
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    })

    // 4. Mock Gemini verification
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ match_found: true, matched_candidate_index: 0 })
    })

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')

    expect(result.isOk()).toBe(true)
    const val = result._unsafeUnwrap()
    expect(val.status).toBe('identified')
    expect(val.productName).toBe('Dutch Mill Delight')
    expect(val.priceRangeMin).toBe(50)
    
    // Verify fallback was NOT called
    expect(mockCallGeminiWithFallback).not.toHaveBeenCalled()
  })

  it('Step 0 no-match correctly falls through to Step 1 and Step 2', async () => {
    // 1. Mock embedding
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [0.1, 0.2, 0.3] }]
    })

    // 2. Mock DB RPC returning empty candidates
    dbMock.rpc.mockResolvedValueOnce({
      data: [],
      error: null
    })

    // 3. Mock Step 1
    mockCallGeminiWithFallback.mockResolvedValueOnce('Step 1 text output with identified brand')
    
    // 4. Mock Step 2
    mockCallGeminiWithFallback.mockResolvedValueOnce({
      status: 'identified',
      product_name: 'Unknown Brand Milk',
      is_child_friendly: true,
      flagged_ingredients: [],
      reasoning: 'Good milk',
      researched_base_price: 100
    })

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')

    expect(result.isOk()).toBe(true)
    const val = result._unsafeUnwrap()
    expect(val.status).toBe('identified')

    // Verify Fallback was called correctly
    expect(mockCallGeminiWithFallback).toHaveBeenCalledTimes(2)
    
    // Check Step 1 arguments
    const step1Call = mockCallGeminiWithFallback.mock.calls[0][0]
    expect(step1Call.useGoogleSearch).toBe(true)
    expect(step1Call.responseSchema).toBeUndefined()

    // Check Step 2 arguments
    const step2Call = mockCallGeminiWithFallback.mock.calls[1][0]
    expect(step2Call.useGoogleSearch).toBe(false)
    expect(step2Call.responseSchema).toBeDefined()
  })

  it('Step 2 is skipped entirely when Step 1 returns blurry', async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [0.1] }]
    })
    dbMock.rpc.mockResolvedValueOnce({ data: [], error: null })

    // Step 1 returns text containing "blurry"
    mockCallGeminiWithFallback.mockResolvedValueOnce('The image is too blurry to identify anything. Status: blurry.')

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')

    expect(result.isOk()).toBe(true)
    const val = result._unsafeUnwrap()
    expect(val.status).toBe('blurry')

    // Verify Fallback was called only ONCE
    expect(mockCallGeminiWithFallback).toHaveBeenCalledTimes(1)
  })

  it('unrecognized status produces correct UI-facing result shape', async () => {
    mockEmbedContent.mockResolvedValueOnce({ embeddings: [{ values: [0.1] }] })
    dbMock.rpc.mockResolvedValueOnce({ data: [], error: null })
    mockCallGeminiWithFallback.mockResolvedValueOnce('Step 1 text')
    mockCallGeminiWithFallback.mockResolvedValueOnce({
      status: 'unrecognized',
      product_name: 'Unknown Juice',
      is_child_friendly: false,
      flagged_ingredients: ['High Sugar'],
      reasoning: 'Too much sugar'
    })

    const result = await visionService.analyzeScan('data:image/jpeg;base64,fakeimage')
    const val = result._unsafeUnwrap()
    expect(val.status).toBe('unrecognized')
    expect(val.productName).toBe('Unknown Juice')
    expect(val.isChildFriendly).toBe(false)
  })
})
