import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VisionService } from '../services/vision.service.js'
import { TransactionService } from '../services/transaction.service.js'
import { QrTokenService } from '../services/qr-token.service.js'
import { ProductsService } from '../services/products.service.js'

// Mock the Gemini SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              candidates: [
                { name: 'Cerelac Rice', confidence: 0.95 }
              ]
            })
          })
        }
      }
    })
  }
})

// Mock Supabase service client
const mockSingleBeneficiary = {
  id: 'b75f7823-3dbd-426c-8ab5-3e284b39e6a9',
  child_name: 'Juan Dela Cruz',
  guardian_name: 'Maria Dela Cruz',
  child_age_months: 8,
  created_at: '2026-01-01T00:00:00.000Z',
  eligibility_status: 'ELIGIBLE',
  credit_balance: 1000.0,
  pin_hash_argon2id: '$argon2id$v=19$m=65536,t=3,p=4$somehash'
}

const mockSingleMerchant = {
  id: 'm1234567-3dbd-426c-8ab5-3e284b39e6a8',
  store_name: 'Aling Nena Sari-Sari',
  owner_name: 'Aling Nena',
  wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  status: 'APPROVED'
}

const mockProduct = {
  id: 'p7890123-3dbd-426c-8ab5-3e284b39e6a7',
  name: 'Cerelac Rice',
  category: 'POWDERED_MILK',
  eligibility_status: 'eligible',
  price_range_min: 100.0,
  price_range_max: 200.0
}

const mockSupabaseClient: any = {
  from: vi.fn().mockImplementation((table) => {
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation((data) => {
        return {
          select: vi.fn().mockImplementation(() => {
            return {
              single: vi.fn().mockResolvedValue({ data: { id: 'generated-id', ...data }, error: null })
            }
          }),
          single: vi.fn().mockResolvedValue({ data: { id: 'generated-id', ...data }, error: null })
        }
      }),
      update: vi.fn().mockImplementation((data) => {
        return {
          eq: vi.fn().mockResolvedValue({ data, error: null })
        }
      }),
      eq: vi.fn().mockImplementation((col, val) => {
        let responseData: any = []
        if (table === 'beneficiaries' && val === mockSingleBeneficiary.id) {
          responseData = mockSingleBeneficiary
        } else if (table === 'merchants' && val === mockSingleMerchant.id) {
          responseData = mockSingleMerchant
        } else if (table === 'products' && col === 'name' && val.includes('Cerelac')) {
          responseData = [mockProduct]
        }

        return {
          single: vi.fn().mockResolvedValue({ data: responseData, error: responseData ? null : new Error('Not found') }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: Array.isArray(responseData) ? responseData : [responseData], error: null }),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: Array.isArray(responseData) ? responseData : [responseData], count: 1, error: null })
        }
      }),
      ilike: vi.fn().mockImplementation(() => {
        return {
          limit: vi.fn().mockResolvedValue({ data: [mockProduct], error: null })
        }
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    }
  })
}

vi.mock('../lib/supabase.js', () => {
  return {
    createServiceClient: () => mockSupabaseClient
  }
})

describe('End-to-End Transaction Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully run the complete transaction flow', async () => {
    // 1. Classify image using Gemini and match in DB catalog
    const visionService = new VisionService(mockSupabaseClient)
    const mockImageBase64 = 'data:image/jpeg;base64,mockimagedatastring'
    
    const classification = await visionService.classifyProduct(mockImageBase64)
    expect(classification.identified).toBe(true)
    if (classification.identified) {
      expect(classification.candidates.length).toBeGreaterThan(0)
      expect(classification.candidates[0].name).toBe('Cerelac Rice')
      expect(classification.candidates[0].product?.eligibility_status).toBe('eligible')
    }

    // 2. Validate manual input/fuzzy matching using ProductsService
    const productsService = new ProductsService(mockSupabaseClient)
    const productMatch = await productsService.validateProduct('Cerelac Rice')
    expect(productMatch.matched).toBe(true)
    if (productMatch.matched) {
      expect(productMatch.product.eligibility_status).toBe('eligible')
      expect(productMatch.product.category).toBe('POWDERED_MILK')
    }

    // 3. QR code token generation and verification
    const qrTokenService = new QrTokenService()
    const token = await qrTokenService.generateToken({
      beneficiaryId: mockSingleBeneficiary.id,
      childName: mockSingleBeneficiary.child_name,
      guardianName: mockSingleBeneficiary.guardian_name,
      tier: 1,
      pin_hash_ref: mockSingleBeneficiary.pin_hash_argon2id.substring(0, 16)
    })

    const verifiedToken = await qrTokenService.verifyToken(token)
    expect(verifiedToken.beneficiaryId).toBe(mockSingleBeneficiary.id)

    // 4. Create transaction and verify transactional outbox emission
    const transactionService = new TransactionService(mockSupabaseClient)
    const items = [
      {
        category: 'POWDERED_MILK',
        name: 'Cerelac Rice',
        quantity: 1,
        unitPricePhp: 120.0,
        creditCost: 120.0
      }
    ]

    const tx = await transactionService.createTransaction({
      beneficiaryId: mockSingleBeneficiary.id,
      merchantId: mockSingleMerchant.id,
      items,
      idempotencyKey: 'a75f7823-3dbd-426c-8ab5-3e284b39e6a0'
    })

    expect(tx.status).toBe('PENDING_CHAIN')
    expect(tx.total_credit_deducted).toBe(120.0)
    expect(tx.stablecoin_amount_wei).toBe((120n * 10n**18n).toString())

    // Verify outbox entry was inserted
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('outbox')
  })
})
