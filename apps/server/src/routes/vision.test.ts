import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.GEMINI_API_KEY = 'fake-gemini-key-for-tests'

// ── Dynamic Gemini response ──
const defaultGeminiResponse = {
  product_name: "Mock Milk",
  is_child_friendly: true,
  flagged_ingredients: ["Sugar"],
  reasoning: "Contains some added sugar, but otherwise safe."
}
let geminiMockResponseText = JSON.stringify(defaultGeminiResponse)
beforeEach(() => { geminiMockResponseText = JSON.stringify(defaultGeminiResponse) })

// Mock the Gemini SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            text: geminiMockResponseText
          })
        })
      }
    }))
  }
})

// Mock supabase db service client
const mockSupabaseClient: any = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'merchant-auth-id',
          email: 'merchant@test.com',
          app_metadata: { role: 'merchant' },
        },
      },
      error: null,
    }),
  },
  from: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'product-1',
        name: 'Mock Milk',
        eligibility_status: 'eligible',
        category: 'DAIRY',
        price_range_min: 50,
        price_range_max: 70
      },
      error: null
    })
  }))
}

vi.mock('../lib/supabase.js', () => ({
  createServiceClient: () => mockSupabaseClient,
}))

const { app } = await import('../app.js')

describe('Vision Route API Tests', () => {
  it.each([100, undefined])('keeps banana price units and nutrition separate for weight %s', async unitWeightGrams => {
    geminiMockResponseText = JSON.stringify({ image_matches: true, is_child_friendly: true,
      reasoning: 'The image shows a fresh banana.', flagged_ingredients: [], suggested_category: 'FRUITS', mismatch_reason: '' })
    const res = await app.request('/api/vision/validate-non-branded', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-token' },
      body: JSON.stringify({ imageBase64: 'fake', productName: 'Banana', price: 10, unit: 'per piece', unitWeightGrams }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isChildFriendly).toBe(true)
    expect(json.isJustified).toBe(unitWeightGrams !== undefined)
    expect(json.priceStatus).toBe(unitWeightGrams === undefined ? 'needs_weight' : 'valid')
    expect(json.researchedPriceUnit).toBe('per kilo')
  })

  it.each([{ unitWeightGrams: 0 }, { unitWeightGrams: -1 }, { unitWeightGrams: 0.5 },
    { unitWeightGrams: 1000001 }, { price: 10.001 }, { unit: 'per truck' }])('rejects invalid price inputs %j', async invalid => {
    const res = await app.request('/api/vision/validate-non-branded', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-token' },
      body: JSON.stringify({ imageBase64: 'fake', productName: 'Banana', price: 10, unit: 'per piece', ...invalid }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/vision/analyze-nutrition returns child safety diagnosis', async () => {
    const res = await app.request('/api/vision/analyze-nutrition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({
        imageBase64: 'data:image/jpeg;base64,mockimagedata'
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.product_name).toBe("Mock Milk")
    expect(json.is_child_friendly).toBe(true)
    expect(json.flagged_ingredients).toContain("Sugar")
    expect(json.reasoning).toBe("Contains some added sugar, but otherwise safe.")
  })

  it('POST /api/vision/analyze-scan returns unified identification and safety data', async () => {
    // Override mock response to return an identified state
    geminiMockResponseText = JSON.stringify({
      status: "identified",
      product_name: "Mock Milk",
      is_child_friendly: true,
      flagged_ingredients: ["Sugar"],
      reasoning: "Safe for kids.",
      researched_base_price: 60
    })

    const res = await app.request('/api/vision/analyze-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({
        imageBase64: 'data:image/jpeg;base64,mockimagedata'
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("identified")
    expect(json.productName).toBe("Mock Milk")
    expect(json.isChildFriendly).toBe(true)
    expect(json.priceRangeMin).toBe(50)
    expect(json.priceRangeMax).toBe(70)
  })
})
