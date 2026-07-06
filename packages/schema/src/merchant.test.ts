import { describe, it, expect } from 'vitest'
import {
  CreateMerchantDto,
  MerchantDto,
  UpdateMerchantDto,
  MerchantStatusSchema,
} from './merchant.js'

describe('MerchantStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const valid = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']
    for (const s of valid) {
      expect(MerchantStatusSchema.parse(s)).toBe(s)
    }
  })

  it('rejects an invalid status', () => {
    expect(() => MerchantStatusSchema.parse('ACTIVE')).toThrow()
  })
})

describe('CreateMerchantDto', () => {
  const validInput = {
    storeName: "Aling Nena's Sari-Sari Store",
    ownerName: 'Nena Cruz',
    mobileNumberE164: '+639171234567',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  }

  it('accepts a valid input with walletAddress', () => {
    expect(CreateMerchantDto.safeParse(validInput).success).toBe(true)
  })

  it('accepts a valid input without walletAddress (optional)', () => {
    const { walletAddress, ...inputWithoutWallet } = validInput
    expect(CreateMerchantDto.safeParse(inputWithoutWallet).success).toBe(true)
  })

  it('rejects empty storeName', () => {
    expect(
      CreateMerchantDto.safeParse({ ...validInput, storeName: '' }).success,
    ).toBe(false)
  })

  it('rejects non-E.164 mobile number', () => {
    expect(
      CreateMerchantDto.safeParse({ ...validInput, mobileNumberE164: '09171234567' })
        .success,
    ).toBe(false)
  })

  it('rejects invalid wallet address', () => {
    expect(
      CreateMerchantDto.safeParse({ ...validInput, walletAddress: '0xinvalid' }).success,
    ).toBe(false)
  })

  it('rejects wallet address with wrong length', () => {
    expect(
      CreateMerchantDto.safeParse({
        ...validInput,
        walletAddress: '0x1234567890abcdef',
      }).success,
    ).toBe(false)
  })
})

describe('MerchantDto', () => {
  const validInput = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    authUserId: 'a47ac10b-58cc-4372-a567-0e02b2c3d480',
    storeName: "Aling Nena's Sari-Sari Store",
    ownerName: 'Nena Cruz',
    mobileNumberE164: '+639171234567',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    walletBalance: 1234.50,
    status: 'APPROVED',
    createdAt: '2026-06-29T00:00:00Z',
  }

  it('accepts a valid input', () => {
    expect(MerchantDto.safeParse(validInput).success).toBe(true)
  })

  it('accepts null walletAddress', () => {
    expect(
      MerchantDto.safeParse({ ...validInput, walletAddress: null }).success,
    ).toBe(true)
  })

  it('rejects invalid UUID for id', () => {
    expect(
      MerchantDto.safeParse({ ...validInput, id: 'not-a-uuid' }).success,
    ).toBe(false)
  })
})

describe('UpdateMerchantDto', () => {
  it('accepts partial update with only storeName', () => {
    expect(UpdateMerchantDto.safeParse({ storeName: 'New Store Name' }).success).toBe(true)
  })

  it('accepts empty object (no-op update)', () => {
    expect(UpdateMerchantDto.safeParse({}).success).toBe(true)
  })

  it('rejects invalid status value', () => {
    expect(UpdateMerchantDto.safeParse({ status: 'ACTIVE' }).success).toBe(false)
  })

  it('rejects invalid wallet address in update', () => {
    expect(
      UpdateMerchantDto.safeParse({ walletAddress: '0xinvalid' }).success,
    ).toBe(false)
  })
})
