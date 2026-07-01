import { describe, it, expect } from 'vitest'
import { QrTokenService } from './qr-token.service.js'

describe('QrTokenService', () => {
  const qrTokenService = new QrTokenService()

  it('generates a JWS compact token and decodes it successfully', async () => {
    const payload = {
      beneficiaryId: '123e4567-e89b-12d3-a456-426614174000',
      childName: 'Baby Doe',
      guardianName: 'Jane Doe',
      tier: 1 as const,
      pin_hash_ref: 'somehashref12345'
    }

    const token = await qrTokenService.generateToken(payload, '1h')
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    const decoded = await qrTokenService.verifyToken(token)
    expect(decoded.beneficiaryId).toBe(payload.beneficiaryId)
    expect(decoded.childName).toBe(payload.childName)
    expect(decoded.guardianName).toBe(payload.guardianName)
    expect(decoded.tier).toBe(payload.tier)
    expect(decoded.pin_hash_ref).toBe(payload.pin_hash_ref)
  })

  it('fails verification for expired or tampered tokens', async () => {
    const payload = {
      beneficiaryId: '123e4567-e89b-12d3-a456-426614174000',
      childName: 'Baby Doe',
      guardianName: 'Jane Doe',
      tier: 1 as const,
      pin_hash_ref: 'somehashref12345'
    }

    // Generate token with 0s expiry (instant expiration)
    const token = await qrTokenService.generateToken(payload, -1) // negative time is expired

    await expect(qrTokenService.verifyToken(token)).rejects.toThrow()
  })
})
