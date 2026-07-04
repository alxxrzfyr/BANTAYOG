import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import type { ChainConfig } from '../lib/chain/config.js'
import type { BeneficiaryWalletRepository } from '../repositories/beneficiary-wallet.repository.js'
import { CustodialWalletService } from './custodial-wallet.service.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildConfig(overrides: Partial<ChainConfig> = {}): ChainConfig {
  return {
    rpcUrl: 'https://rpc-amoy.example.com',
    chainId: 80002,
    deployerKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    lguAdminWallet: '0x1234567890123456789012345678901234567890',
    phpcTokenAddress: '0xABCDEF0123456789ABCDEF0123456789ABCDEF01',
    phpcSubsidyAddress: '0x9876543210987654321098765432109876543210',
    keyEncryptionKey: 'test-key-encryption-key',
    qrTokenSecret: 'test-qr-token-secret',
    qrTokenTtlSeconds: 300,
    ...overrides,
  }
}

function buildMockRepo(overrides: { findBy?: ReturnType<typeof vi.fn>; insert?: ReturnType<typeof vi.fn> } = {}) {
  const findByMock = overrides.findBy ?? vi.fn()
  const insertMock = overrides.insert ?? vi.fn()
  const mockRepo = { findBy: findByMock, insert: insertMock } as unknown as BeneficiaryWalletRepository
  return { mockRepo, findByMock, insertMock }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CustodialWalletService.generateWallet', () => {
  it('treats wallet generation as failed after exactly 3 collision attempts, without inserting a row', async () => {
    const { mockRepo, findByMock, insertMock } = buildMockRepo({
      findBy: vi.fn().mockResolvedValue([{ address: '0xcollision0000000000000000000000000000000' }]),
    })

    const service = new CustodialWalletService(buildConfig(), mockRepo)
    const result = await service.generateWallet('some-beneficiary-id')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('3 attempts')
    }
    // Exactly 3 attempts, not more, not fewer.
    expect(findByMock).toHaveBeenCalledTimes(3)
    // Never persisted since every attempt collided.
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('succeeds on the first attempt and inserts exactly once when there is no collision', async () => {
    const { mockRepo, findByMock, insertMock } = buildMockRepo({
      findBy: vi.fn().mockResolvedValue([]),
    })

    const service = new CustodialWalletService(buildConfig(), mockRepo)
    const result = await service.generateWallet('some-beneficiary-id')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
    // No collision means uniqueness is verified once, on the first attempt.
    expect(findByMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Property 9: Each beneficiary maps to exactly one globally unique wallet
// address, with collision retry.
// Feature: polygon-amoy-phpc-migration, Property 9: Each beneficiary maps to
// exactly one globally unique wallet address, with collision retry
// Validates: Requirements 5.1, 5.3, 5.4
// ---------------------------------------------------------------------------

describe('Property 9: each beneficiary maps to exactly one globally unique wallet address, with collision retry', () => {
  it('retries up to 3 attempts on collision and succeeds once a unique address is found, or fails after exhausting all 3', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (collisionsBeforeUnique) => {
        // collisionsBeforeUnique: how many of the first N findBy calls report a
        // collision before a unique address is found (0 = succeeds immediately,
        // 3 = never unique -> fails).
        let callCount = 0
        const findByMock = vi.fn().mockImplementation(async () => {
          callCount++
          return callCount <= collisionsBeforeUnique
            ? [{ address: '0xcollision0000000000000000000000000000000' }]
            : []
        })
        const insertMock = vi.fn().mockResolvedValue(undefined)
        const mockRepo = { findBy: findByMock, insert: insertMock } as unknown as BeneficiaryWalletRepository

        const service = new CustodialWalletService(buildConfig(), mockRepo)
        const result = await service.generateWallet('beneficiary-x')

        if (collisionsBeforeUnique < 3) {
          expect(result.isOk()).toBe(true)
          expect(findByMock).toHaveBeenCalledTimes(collisionsBeforeUnique + 1)
          expect(insertMock).toHaveBeenCalledTimes(1)
        } else {
          expect(result.isErr()).toBe(true)
          expect(findByMock).toHaveBeenCalledTimes(3)
          expect(insertMock).not.toHaveBeenCalled()
        }
      }),
      { numRuns: 20 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 10: Beneficiary private keys are persisted only in encrypted
// form.
// Feature: polygon-amoy-phpc-migration, Property 10: Beneficiary private
// keys are persisted only in encrypted form
// Validates: Requirements 5.2, 6.1
// ---------------------------------------------------------------------------

describe('Property 10: beneficiary private keys are persisted only in encrypted form', () => {
  it('never persists the plaintext private key; only ciphertext/iv/authTag are inserted, and ciphertext differs from plaintext', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (beneficiaryId) => {
        const { mockRepo, insertMock } = buildMockRepo({ findBy: vi.fn().mockResolvedValue([]) })

        const service = new CustodialWalletService(buildConfig(), mockRepo)
        const result = await service.generateWallet(beneficiaryId)
        expect(result.isOk()).toBe(true)

        expect(insertMock).toHaveBeenCalledTimes(1)
        const insertedRow = insertMock.mock.calls[0][0]
        expect(insertedRow).toHaveProperty('enc_ciphertext')
        expect(insertedRow).toHaveProperty('enc_iv')
        expect(insertedRow).toHaveProperty('enc_auth_tag')
        expect(insertedRow).not.toHaveProperty('privateKey')
        expect(insertedRow).not.toHaveProperty('private_key')
        // The ciphertext must not equal a hex/plaintext-looking private key format.
        expect(insertedRow.enc_ciphertext).not.toMatch(/^0x[0-9a-fA-F]{64}$/)
      }),
      { numRuns: 30 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 11: Wallet key encryption/decryption round-trip enables signing.
// Feature: polygon-amoy-phpc-migration, Property 11: Wallet key
// encryption/decryption round-trip enables signing
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

describe('Property 11: wallet key encryption/decryption round-trip enables signing', () => {
  it('signWithBeneficiaryKey decrypts the stored key and produces a valid signature via signFn', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (beneficiaryId) => {
        // Capture what generateWallet actually encrypts by using a mock repo
        // that stores the inserted row, then feeding it back via findBy for
        // signWithBeneficiaryKey.
        let storedRow: any
        const findByMock = vi.fn().mockImplementation(async (column: string) => {
          if (column === 'address') return [] // no collision during generateWallet
          if (column === 'beneficiary_id') return storedRow ? [storedRow] : []
          return []
        })
        const insertMock = vi.fn().mockImplementation(async (row: any) => {
          storedRow = row
          return row
        })
        const mockRepo = { findBy: findByMock, insert: insertMock } as unknown as BeneficiaryWalletRepository

        const service = new CustodialWalletService(buildConfig(), mockRepo)
        const genResult = await service.generateWallet(beneficiaryId)
        expect(genResult.isOk()).toBe(true)

        const signResult = await service.signWithBeneficiaryKey(beneficiaryId, async (account) => {
          // signFn receives a real viem Account derived from the decrypted key
          // — prove it's usable by signing a message and returning the signer
          // address.
          const signature = await account.signMessage({ message: 'round-trip-test' })
          return { address: account.address, signature }
        })

        expect(signResult.isOk()).toBe(true)
        if (signResult.isOk() && genResult.isOk()) {
          expect(signResult.value.address.toLowerCase()).toBe(genResult.value.address.toLowerCase())
          expect(signResult.value.signature).toMatch(/^0x[0-9a-fA-F]+$/)
        }
      }),
      { numRuns: 20 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 12: Decrypted key material is erased after signing.
// Feature: polygon-amoy-phpc-migration, Property 12: Decrypted key material
// is erased after signing
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------

describe('Property 12: decrypted key material is erased after signing', () => {
  it('zeroizes the decrypted key buffer (via Buffer.prototype.fill(0)) whether signFn succeeds or throws', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.boolean(), async (beneficiaryId, shouldThrow) => {
        let storedRow: any
        const findByMock = vi.fn().mockImplementation(async (column: string) => {
          if (column === 'address') return []
          if (column === 'beneficiary_id') return storedRow ? [storedRow] : []
          return []
        })
        const insertMock = vi.fn().mockImplementation(async (row: any) => {
          storedRow = row
          return row
        })
        const mockRepo = { findBy: findByMock, insert: insertMock } as unknown as BeneficiaryWalletRepository

        const service = new CustodialWalletService(buildConfig(), mockRepo)
        await service.generateWallet(beneficiaryId)

        // Spy on Buffer.prototype.fill to directly observe zeroization of the
        // decrypted key buffer. This is the most direct verification
        // available without modifying the production code's public API for
        // testability — `keyBuffer` is a private local variable, but its
        // `.fill(0)` call is a real prototype method call we can intercept.
        const fillSpy = vi.spyOn(Buffer.prototype, 'fill')

        const signResult = await service.signWithBeneficiaryKey(beneficiaryId, async (account) => {
          if (shouldThrow) {
            throw new Error('simulated signFn failure')
          }
          return account.address
        })

        if (shouldThrow) {
          expect(signResult.isErr()).toBe(true)
        } else {
          expect(signResult.isOk()).toBe(true)
        }

        // The decrypted key buffer must have been zeroized with fill(0),
        // regardless of whether signFn succeeded or threw.
        const zeroFillCalls = fillSpy.mock.calls.filter((args) => args[0] === 0)
        expect(zeroFillCalls.length).toBeGreaterThanOrEqual(1)

        fillSpy.mockRestore()

        // A second independent call must still work correctly (no lingering
        // state from the first call's buffer leaks across calls).
        const secondSignResult = await service.signWithBeneficiaryKey(beneficiaryId, async (account) => account.address)
        expect(secondSignResult.isOk()).toBe(true)
      }),
      { numRuns: 20 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 13: Decryption failure aborts signing without exposing or
// mutating key material.
// Feature: polygon-amoy-phpc-migration, Property 13: Decryption failure
// aborts signing without exposing or mutating key material
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------

describe('Property 13: decryption failure aborts signing without exposing or mutating key material', () => {
  it('aborts and returns an error excluding key material when the stored ciphertext is corrupted', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (beneficiaryId) => {
        const corruptedRow = {
          enc_ciphertext: 'not-valid-base64-ciphertext!!!',
          enc_iv: Buffer.from('aaaaaaaaaaaa').toString('base64'), // valid-length but wrong IV
          enc_auth_tag: Buffer.from('bbbbbbbbbbbbbbbb').toString('base64'),
        }
        const findByMock = vi.fn().mockResolvedValue([corruptedRow])
        const mockRepo = { findBy: findByMock, insert: vi.fn() } as unknown as BeneficiaryWalletRepository

        const service = new CustodialWalletService(buildConfig(), mockRepo)
        let signFnCalled = false
        const signResult = await service.signWithBeneficiaryKey(beneficiaryId, async (account) => {
          signFnCalled = true
          return account.address
        })

        expect(signResult.isErr()).toBe(true)
        expect(signFnCalled).toBe(false) // signFn must never be invoked on decryption failure
        if (signResult.isErr()) {
          // The error must not leak the corrupted ciphertext or any key-like hex string.
          expect(signResult.error.message).not.toContain(corruptedRow.enc_ciphertext)
        }
      }),
      { numRuns: 20 },
    )
  })
})
