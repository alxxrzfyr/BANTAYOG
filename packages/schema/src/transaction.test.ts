import { describe, it, expect } from 'vitest'
import {
  TransactionStatusSchema,
  NutritionCategorySchema,
  TransactionItemDto,
  CreateTransactionDto,
  TransactionDto,
  TransactionStatusDto,
  VisionClassifyDto,
  VisionItemDto,
  VisionResultDto,
  VisionManualValidateDto,
} from './transaction.js'

describe('TransactionStatusSchema', () => {
  it('accepts all lifecycle states', () => {
    const valid = [
      'PENDING_CHAIN',
      'CONFIRMED',
      'DB_RECORDED',
      'BROADCAST',
      'RECONCILED',
      'FAILED',
    ]
    for (const s of valid) {
      expect(TransactionStatusSchema.parse(s)).toBe(s)
    }
  })

  it('rejects an invalid status', () => {
    expect(() => TransactionStatusSchema.parse('COMPLETED')).toThrow()
  })
})

describe('NutritionCategorySchema', () => {
  it('accepts all 10 allowlist categories', () => {
    const valid = [
      'EGGS',
      'FRESH_MILK',
      'POWDERED_MILK',
      'VEGETABLES',
      'LEAN_MEAT',
      'FISH',
      'BEANS_LENTILS',
      'RICE_BROWN',
      'FRUIT_FRESH',
      'NUT_BUTTER',
    ]
    for (const c of valid) {
      expect(NutritionCategorySchema.parse(c)).toBe(c)
    }
  })

  it('rejects a non-allowlisted category', () => {
    expect(() => NutritionCategorySchema.parse('INSTANT_NOODLES')).toThrow()
  })
})

describe('TransactionItemDto', () => {
  const validItem = {
    category: 'EGGS',
    name: 'Farm Fresh Eggs (dozen)',
    quantity: 1,
    unitPricePhp: 120,
    creditCost: 120,
  }

  it('accepts a valid item', () => {
    expect(TransactionItemDto.safeParse(validItem).success).toBe(true)
  })

  it('rejects zero quantity', () => {
    expect(
      TransactionItemDto.safeParse({ ...validItem, quantity: 0 }).success,
    ).toBe(false)
  })

  it('rejects negative unitPricePhp', () => {
    expect(
      TransactionItemDto.safeParse({ ...validItem, unitPricePhp: -10 }).success,
    ).toBe(false)
  })

  it('rejects non-allowlisted category', () => {
    expect(
      TransactionItemDto.safeParse({ ...validItem, category: 'CANDY' }).success,
    ).toBe(false)
  })
})

describe('CreateTransactionDto', () => {
  const validInput = {
    qrToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature',
    pin: '1234',
    items: [
      {
        category: 'EGGS',
        name: 'Farm Fresh Eggs (dozen)',
        quantity: 1,
        unitPricePhp: 120,
        creditCost: 120,
      },
      {
        category: 'FRESH_MILK',
        name: 'Bear Brand Milk 200ml',
        quantity: 2,
        unitPricePhp: 25,
        creditCost: 50,
      },
    ],
    idempotencyKey: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  }

  it('accepts a valid transaction draft', () => {
    expect(CreateTransactionDto.safeParse(validInput).success).toBe(true)
  })

  it('rejects empty items array', () => {
    expect(
      CreateTransactionDto.safeParse({ ...validInput, items: [] }).success,
    ).toBe(false)
  })

  it('rejects invalid idempotencyKey (not UUID)', () => {
    expect(
      CreateTransactionDto.safeParse({ ...validInput, idempotencyKey: 'abc' }).success,
    ).toBe(false)
  })

  it('rejects empty qrToken', () => {
    expect(
      CreateTransactionDto.safeParse({ ...validInput, qrToken: '' }).success,
    ).toBe(false)
  })

  it('accepts optional photoStoragePath', () => {
    expect(
      CreateTransactionDto.safeParse({
        ...validInput,
        photoStoragePath: 'receipts/tx-123.jpg',
      }).success,
    ).toBe(true)
  })
})

describe('TransactionDto', () => {
  const validInput = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    beneficiaryId: 'a47ac10b-58cc-4372-a567-0e02b2c3d480',
    merchantId: 'b47ac10b-58cc-4372-a567-0e02b2c3d481',
    items: [
      {
        category: 'EGGS',
        name: 'Farm Fresh Eggs (dozen)',
        quantity: 1,
        unitPricePhp: 120,
        creditCost: 120,
      },
    ],
    totalCreditDeducted: 120,
    stablecoinAmountWei: '120000000000000000000',
    onchainTxHash: null,
    idempotencyKey: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    status: 'PENDING_CHAIN',
    createdAt: '2026-06-29T00:00:00Z',
    confirmedAt: null,
  }

  it('accepts a valid transaction', () => {
    expect(TransactionDto.safeParse(validInput).success).toBe(true)
  })

  it('accepts confirmedAt as datetime', () => {
    expect(
      TransactionDto.safeParse({
        ...validInput,
        status: 'CONFIRMED',
        onchainTxHash: '0xabc123',
        confirmedAt: '2026-06-29T00:01:00Z',
      }).success,
    ).toBe(true)
  })
})

describe('TransactionStatusDto', () => {
  it('accepts valid status query result', () => {
    expect(
      TransactionStatusDto.safeParse({
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        status: 'RECONCILED',
        onchainTxHash: '0xabc123def456',
        confirmedAt: '2026-06-29T00:01:00Z',
      }).success,
    ).toBe(true)
  })
})

describe('Vision DTOs', () => {
  it('VisionClassifyDto accepts valid storagePath', () => {
    expect(VisionClassifyDto.safeParse({ storagePath: 'receipts/tx-123.jpg' }).success).toBe(true)
  })

  it('VisionClassifyDto rejects empty storagePath', () => {
    expect(VisionClassifyDto.safeParse({ storagePath: '' }).success).toBe(false)
  })

  it('VisionItemDto accepts valid item with confidence', () => {
    expect(
      VisionItemDto.safeParse({
        category: 'EGGS',
        name: 'Eggs',
        confidence: 0.95,
      }).success,
    ).toBe(true)
  })

  it('VisionItemDto rejects confidence > 1', () => {
    expect(
      VisionItemDto.safeParse({
        category: 'EGGS',
        name: 'Eggs',
        confidence: 1.5,
      }).success,
    ).toBe(false)
  })

  it('VisionResultDto accepts valid result', () => {
    expect(
      VisionResultDto.safeParse({
        items: [
          { category: 'EGGS', name: 'Eggs', confidence: 0.95 },
          { category: 'FRESH_MILK', name: 'Milk', confidence: 0.88 },
        ],
        processingTimeMs: 1500,
      }).success,
    ).toBe(true)
  })

  it('VisionManualValidateDto accepts valid input', () => {
    expect(
      VisionManualValidateDto.safeParse({
        category: 'VEGETABLES',
        name: 'Kangkong',
      }).success,
    ).toBe(true)
  })

  it('VisionManualValidateDto rejects non-allowlisted category', () => {
    expect(
      VisionManualValidateDto.safeParse({
        category: 'SODA',
        name: 'Coke',
      }).success,
    ).toBe(false)
  })
})
