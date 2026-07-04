import { describe, it, expect, vi, afterEach } from 'vitest'
import fc from 'fast-check'
import { QrTokenService } from './qr-token.service.js'

describe('QrTokenService', () => {
  const qrTokenService = new QrTokenService()

  it('generates a JWS compact token and decodes it successfully', async () => {
    const payload = {
      beneficiaryId: '123e4567-e89b-12d3-a456-426614174000',
      childName: 'Baby Doe',
      guardianName: 'Jane Doe',
      tier: 1 as const,
      pin_hash_ref: 'somehashref12345',
      walletRef: '0x1234567890123456789012345678901234567890'
    }

    const tokenResult = await qrTokenService.generateToken(payload)
    expect(tokenResult.isOk()).toBe(true)
    const token = tokenResult._unsafeUnwrap()
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    const decodedResult = await qrTokenService.verifyToken(token)
    expect(decodedResult.isOk()).toBe(true)
    const decoded = decodedResult._unsafeUnwrap()
    expect(decoded.beneficiaryId).toBe(payload.beneficiaryId)
    expect(decoded.childName).toBe(payload.childName)
    expect(decoded.guardianName).toBe(payload.guardianName)
    expect(decoded.tier).toBe(payload.tier)
    expect(decoded.pin_hash_ref).toBe(payload.pin_hash_ref)
    expect(decoded.walletRef).toBe(payload.walletRef)
  })

  it('fails verification for expired or tampered tokens', async () => {
    const payload = {
      beneficiaryId: '123e4567-e89b-12d3-a456-426614174000',
      childName: 'Baby Doe',
      guardianName: 'Jane Doe',
      tier: 1 as const,
      pin_hash_ref: 'somehashref12345',
      walletRef: '0x1234567890123456789012345678901234567890'
    }

    // Construct with a negative TTL so the embedded expiration is already
    // in the past (instant expiration) — TTL is now construction-time only.
    const expiredTokenService = new QrTokenService(-1)
    const tokenResult = await expiredTokenService.generateToken(payload)
    expect(tokenResult.isOk()).toBe(true)
    const token = tokenResult._unsafeUnwrap()

    const decodedResult = await qrTokenService.verifyToken(token)
    expect(decodedResult.isErr()).toBe(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('embeds an expiration of exactly iat + 300 when qrTokenTtlSeconds is omitted (default TTL)', async () => {
    const fixedMs = 1700000000000
    // jose's setIssuedAt() reads `new Date()` internally (not Date.now()),
    // so fake timers (which patch the Date constructor) are required to
    // keep setIssuedAt() and the expirationTime computation consistent.
    vi.useFakeTimers()
    vi.setSystemTime(fixedMs)

    // No argument passed — relies on the constructor's default TTL of 300s (Requirement 9.1).
    const defaultTtlService = new QrTokenService()

    const payload = {
      beneficiaryId: '123e4567-e89b-12d3-a456-426614174000',
      childName: 'Baby Doe',
      guardianName: 'Jane Doe',
      tier: 1 as const,
      pin_hash_ref: 'somehashref12345',
      walletRef: '0x1234567890123456789012345678901234567890'
    }

    const tokenResult = await defaultTtlService.generateToken(payload)
    expect(tokenResult.isOk()).toBe(true)
    const token = tokenResult._unsafeUnwrap()

    // Decode the JWT payload segment directly to read raw iat/exp claims,
    // independent of verifyToken's typed return shape.
    const payloadSegment = token.split('.')[1]
    const decodedClaims = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString())

    expect(decodedClaims.iat).toBe(Math.floor(fixedMs / 1000))
    expect(decodedClaims.exp).toBe(decodedClaims.iat + 300)
  })
})


// Feature: polygon-amoy-phpc-migration, Property 21: QR token generation embeds signature and TTL-based expiration
// Validates: Requirements 9.1
describe('Property 21: QR token generation embeds signature and TTL-based expiration (Requirement 9.1)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('embeds an expiration equal to iat + the configured TTL, for arbitrary positive TTLs', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 86400 }), fc.uuid(), async (ttlSeconds, beneficiaryId) => {
        const fixedMs = 1700000000000
        try {
          vi.useFakeTimers()
          vi.setSystemTime(fixedMs)

          const service = new QrTokenService(ttlSeconds)
          const tokenResult = await service.generateToken({
            beneficiaryId,
            childName: 'Child',
            guardianName: 'Guardian',
            tier: 1,
            pin_hash_ref: 'ref',
            walletRef: '0x1234567890123456789012345678901234567890',
          })
          expect(tokenResult.isOk()).toBe(true)
          if (!tokenResult.isOk()) return
          const token = tokenResult.value

          const [, payloadSegment] = token.split('.')
          const claims = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString())

          expect(claims.iat).toBe(Math.floor(fixedMs / 1000))
          expect(claims.exp).toBe(claims.iat + ttlSeconds)
        } finally {
          vi.useRealTimers()
        }
      }),
      { numRuns: 30 },
    )
  })
})

// Feature: polygon-amoy-phpc-migration, Property 22: QR token generate-then-verify round-trip resolves the same beneficiary and wallet
// Validates: Requirements 7.1, 9.2, 9.3, 5.5
describe('Property 22: QR token generate-then-verify round-trip resolves the same beneficiary and wallet (Requirements 7.1, 9.2, 9.3, 5.5)', () => {
  it('verifying a freshly generated token returns the exact beneficiaryId, walletRef, tier, childName, guardianName that were encoded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom(1, 2),
        fc.stringMatching(/^[0-9a-f]{40}$/).map((h) => `0x${h}`),
        async (beneficiaryId, childName, guardianName, tier, walletRef) => {
          const service = new QrTokenService(300)
          const tokenResult = await service.generateToken({
            beneficiaryId,
            childName,
            guardianName,
            tier,
            pin_hash_ref: 'somehashref',
            walletRef,
          })
          expect(tokenResult.isOk()).toBe(true)
          if (!tokenResult.isOk()) return

          const verifyResult = await service.verifyToken(tokenResult.value)
          expect(verifyResult.isOk()).toBe(true)
          if (!verifyResult.isOk()) return

          expect(verifyResult.value.beneficiaryId).toBe(beneficiaryId)
          expect(verifyResult.value.walletRef).toBe(walletRef)
          expect(verifyResult.value.tier).toBe(tier)
          expect(verifyResult.value.childName).toBe(childName)
          expect(verifyResult.value.guardianName).toBe(guardianName)
        },
      ),
      { numRuns: 50 },
    )
  })
})

// Feature: polygon-amoy-phpc-migration, Property 23: Tampered, mis-signed, or expired QR tokens are rejected without resolving data
// Validates: Requirements 7.2, 9.4, 9.5, 9.6
describe('Property 23: tampered, mis-signed, or expired QR tokens are rejected without resolving data (Requirements 7.2, 9.4, 9.5, 9.6)', () => {
  it('rejects a token whose payload segment was tampered with, without returning any beneficiary data', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (beneficiaryId) => {
        const service = new QrTokenService(300)
        const tokenResult = await service.generateToken({
          beneficiaryId,
          childName: 'Child',
          guardianName: 'Guardian',
          tier: 1,
          pin_hash_ref: 'ref',
          walletRef: '0x1234567890123456789012345678901234567890',
        })
        expect(tokenResult.isOk()).toBe(true)
        if (!tokenResult.isOk()) return

        const [header, payload, signature] = tokenResult.value.split('.')
        // Tamper the payload segment by flipping its last character (still
        // valid base64url alphabet-wise in most cases; if this particular
        // char happens to be non-flippable, the resulting decode may differ
        // in a way that still changes the payload — any single-character
        // change to a base64url segment changes the decoded bytes almost
        // always, and even in the rare unchanged-decode case the signature
        // will no longer match since jose verifies the RAW segment bytes,
        // not just the decoded JSON).
        const tamperedPayload = payload.slice(0, -1) + (payload.slice(-1) === 'A' ? 'B' : 'A')
        const tamperedToken = [header, tamperedPayload, signature].join('.')

        const verifyResult = await service.verifyToken(tamperedToken)
        expect(verifyResult.isErr()).toBe(true)
      }),
      { numRuns: 30 },
    )
  })

  it('rejects a token signed with a different secret (mis-signed)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (beneficiaryId) => {
        const originalSecret = process.env.QR_TOKEN_SECRET
        try {
          process.env.QR_TOKEN_SECRET = 'secret-A-for-signing'
          const signingService = new QrTokenService(300)
          const tokenResult = await signingService.generateToken({
            beneficiaryId,
            childName: 'Child',
            guardianName: 'Guardian',
            tier: 1,
            pin_hash_ref: 'ref',
            walletRef: '0x1234567890123456789012345678901234567890',
          })
          expect(tokenResult.isOk()).toBe(true)

          // Verify with a DIFFERENT secret configured.
          process.env.QR_TOKEN_SECRET = 'secret-B-different'
          const verifyingService = new QrTokenService(300)
          if (tokenResult.isOk()) {
            const verifyResult = await verifyingService.verifyToken(tokenResult.value)
            expect(verifyResult.isErr()).toBe(true)
          }
        } finally {
          process.env.QR_TOKEN_SECRET = originalSecret
        }
      }),
      { numRuns: 20 },
    )
  })

  it('rejects an already-expired token (negative/zero TTL) without resolving data', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.integer({ min: -100, max: 0 }), async (beneficiaryId, ttlSeconds) => {
        const service = new QrTokenService(ttlSeconds)
        const tokenResult = await service.generateToken({
          beneficiaryId,
          childName: 'Child',
          guardianName: 'Guardian',
          tier: 1,
          pin_hash_ref: 'ref',
          walletRef: '0x1234567890123456789012345678901234567890',
        })
        expect(tokenResult.isOk()).toBe(true)
        if (!tokenResult.isOk()) return

        const verifyResult = await service.verifyToken(tokenResult.value)
        expect(verifyResult.isErr()).toBe(true)
      }),
      { numRuns: 20 },
    )
  })
})
