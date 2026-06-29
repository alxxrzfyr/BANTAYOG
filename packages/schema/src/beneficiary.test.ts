import { describe, it, expect } from 'vitest'
import {
  CreateBeneficiaryDto,
  BeneficiaryDto,
  BeneficiaryBalanceDto,
  IssueQrTokenDto,
  QrTokenDto,
  QrVerifyDto,
  QrVerifyResultDto,
  EligibilityStatusSchema,
} from './beneficiary.js'

describe('EligibilityStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const valid = ['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'SUSPENDED']
    for (const s of valid) {
      expect(EligibilityStatusSchema.parse(s)).toBe(s)
    }
  })

  it('rejects an invalid status', () => {
    expect(() => EligibilityStatusSchema.parse('APPROVED')).toThrow()
  })
})

describe('CreateBeneficiaryDto', () => {
  const validInput = {
    guardianName: 'Maria Santos',
    guardianMobileHash: 'sha256:abc123',
    childName: 'Baby Santos',
    childAgeMonths: 12,
    monthlyIncomePhp: 8000,
    gpsLat: 14.5995,
    gpsLng: 120.9842,
    pin: '1234',
  }

  it('accepts a valid input', () => {
    const result = CreateBeneficiaryDto.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects empty guardianName', () => {
    const result = CreateBeneficiaryDto.safeParse({ ...validInput, guardianName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects childAgeMonths > 120', () => {
    const result = CreateBeneficiaryDto.safeParse({ ...validInput, childAgeMonths: 200 })
    expect(result.success).toBe(false)
  })

  it('rejects negative monthlyIncomePhp', () => {
    const result = CreateBeneficiaryDto.safeParse({ ...validInput, monthlyIncomePhp: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects gpsLat out of range', () => {
    expect(
      CreateBeneficiaryDto.safeParse({ ...validInput, gpsLat: 91 }).success,
    ).toBe(false)
    expect(
      CreateBeneficiaryDto.safeParse({ ...validInput, gpsLat: -91 }).success,
    ).toBe(false)
  })

  it('rejects gpsLng out of range', () => {
    expect(
      CreateBeneficiaryDto.safeParse({ ...validInput, gpsLng: 181 }).success,
    ).toBe(false)
  })

  it('rejects pin shorter than 4 chars', () => {
    const result = CreateBeneficiaryDto.safeParse({ ...validInput, pin: '12' })
    expect(result.success).toBe(false)
  })

  it('rejects pin longer than 12 chars', () => {
    const result = CreateBeneficiaryDto.safeParse({ ...validInput, pin: '1234567890123' })
    expect(result.success).toBe(false)
  })
})

describe('BeneficiaryDto', () => {
  const validInput = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    guardianName: 'Maria Santos',
    guardianMobileHash: 'sha256:abc123',
    childName: 'Baby Santos',
    childAgeMonths: 12,
    monthlyIncomePhp: 8000,
    gpsLat: 14.5995,
    gpsLng: 120.9842,
    eligibilityStatus: 'ELIGIBLE',
    creditBalance: 500.0,
    cardSerial: 'ABC123DEF456',
    activatedAt: '2026-06-29T00:00:00Z',
    deactivatedAt: null,
    createdAt: '2026-06-29T00:00:00Z',
  }

  it('accepts a valid input', () => {
    const result = BeneficiaryDto.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepts null cardSerial and activatedAt', () => {
    const result = BeneficiaryDto.safeParse({
      ...validInput,
      cardSerial: null,
      activatedAt: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid id (not a UUID)', () => {
    const result = BeneficiaryDto.safeParse({ ...validInput, id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects negative creditBalance', () => {
    const result = BeneficiaryDto.safeParse({ ...validInput, creditBalance: -10 })
    expect(result.success).toBe(false)
  })
})

describe('BeneficiaryBalanceDto', () => {
  it('accepts valid input with onchain balance', () => {
    const result = BeneficiaryBalanceDto.safeParse({
      beneficiaryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      creditBalance: 500,
      onchainBalanceWei: '1000000000000000000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null onchainBalanceWei', () => {
    const result = BeneficiaryBalanceDto.safeParse({
      beneficiaryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      creditBalance: 0,
      onchainBalanceWei: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('QrToken DTOs', () => {
  it('IssueQrTokenDto accepts valid beneficiaryId', () => {
    expect(
      IssueQrTokenDto.safeParse({
        beneficiaryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      }).success,
    ).toBe(true)
  })

  it('QrTokenDto accepts valid token output', () => {
    expect(
      QrTokenDto.safeParse({
        jwsCompact: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature',
        cardSerial: 'ABC123DEF456',
        expiresAt: '2026-09-29T00:00:00Z',
      }).success,
    ).toBe(true)
  })

  it('QrVerifyDto rejects empty token', () => {
    expect(QrVerifyDto.safeParse({ token: '' }).success).toBe(false)
  })

  it('QrVerifyResultDto accepts valid=true with data', () => {
    expect(
      QrVerifyResultDto.safeParse({
        valid: true,
        cardSerial: 'ABC123DEF456',
        creditBalance: 500,
        expired: false,
        revoked: false,
      }).success,
    ).toBe(true)
  })

  it('QrVerifyResultDto accepts valid=false with nulls', () => {
    expect(
      QrVerifyResultDto.safeParse({
        valid: false,
        cardSerial: null,
        creditBalance: null,
        expired: true,
        revoked: false,
      }).success,
    ).toBe(true)
  })
})
