/**
 * Property-based and unit tests for `loadChainConfig`.
 *
 * Feature: polygon-amoy-phpc-migration
 * Property 1: Chain config loads valid env and reports every offender otherwise
 * Property 2: Runtime config never targets the local Hardhat network
 *
 * Validates: Requirements 1.1, 1.4, 1.5, 1.8, 10.1, 10.2, 10.3, 10.5
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { loadChainConfig, type ChainEnv } from './config.js'
import { ValidationError } from '../errors.js'

// ---------------------------------------------------------------------------
// Arbitraries — valid values for each of the 7 required fields, plus the
// optional QR_TOKEN_TTL_SECONDS.
// ---------------------------------------------------------------------------

const validUrlArb = fc.constantFrom(
  'https://rpc-amoy.example.com',
  'https://another-rpc.example.org',
  'http://rpc-test.example.net',
)

const validPrivateKeyArb = fc.stringMatching(/^[0-9a-f]{64}$/).map((h) => `0x${h}` as const)

const validAddressArb = fc.stringMatching(/^[0-9a-f]{40}$/).map((h) => `0x${h}` as const)

// keyEncryptionKey/qrTokenSecret only require non-empty per the
// implementation (no format validation beyond `!value`).
const validSecretArb = fc.string({ minLength: 1, maxLength: 40 })

const validTtlArb = fc.integer({ min: 1, max: 100_000 }).map((n) => String(n))

const validEnvArbitrary: fc.Arbitrary<ChainEnv> = fc.record({
  POLYGON_AMOY_RPC_URL: validUrlArb,
  DEPLOYER_PRIVATE_KEY: validPrivateKeyArb,
  LGU_ADMIN_WALLET_ADDRESS: validAddressArb,
  PHPC_TOKEN_ADDRESS: validAddressArb,
  PHPC_SUBSIDY_ADDRESS: validAddressArb,
  CUSTODIAL_KEY_ENCRYPTION_KEY: validSecretArb,
  QR_TOKEN_SECRET: validSecretArb,
  QR_TOKEN_TTL_SECONDS: fc.option(validTtlArb, { nil: undefined }),
})

// ---------------------------------------------------------------------------
// Arbitraries — bad-value pools for each required field, used to build
// "at least one offending field" environments.
// ---------------------------------------------------------------------------

const badUrlArb = fc.constantFrom(
  undefined,
  '',
  'not-a-url',
  'ftp://bad.com',
  'http://localhost:3000',
  'http://127.0.0.1:8545',
)

const badPrivateKeyArb = fc.constantFrom(
  undefined,
  '',
  '0x1234',
  'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff8', // missing 0x prefix
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff', // 62 hex chars, too short
)

const badAddressArb = fc.constantFrom(
  undefined,
  '',
  '0x1234',
  '1234567890123456789012345678901234567890', // missing 0x prefix
  '0xZZZZ567890123456789012345678901234567890', // non-hex chars
)

const badSecretArb = fc.constantFrom(undefined, '')

interface RequiredField {
  name: string
  badValues: fc.Arbitrary<string | undefined>
}

const requiredFields: RequiredField[] = [
  { name: 'POLYGON_AMOY_RPC_URL', badValues: badUrlArb },
  { name: 'DEPLOYER_PRIVATE_KEY', badValues: badPrivateKeyArb },
  { name: 'LGU_ADMIN_WALLET_ADDRESS', badValues: badAddressArb },
  { name: 'PHPC_TOKEN_ADDRESS', badValues: badAddressArb },
  { name: 'PHPC_SUBSIDY_ADDRESS', badValues: badAddressArb },
  { name: 'CUSTODIAL_KEY_ENCRYPTION_KEY', badValues: badSecretArb },
  { name: 'QR_TOKEN_SECRET', badValues: badSecretArb },
]

// Picks one required field's index, then a bad value from that field's pool.
const invalidFieldSelectionArb = fc
  .integer({ min: 0, max: requiredFields.length - 1 })
  .chain((idx) => requiredFields[idx].badValues.map((badValue) => ({ idx, badValue })))

// A valid baseline env with exactly one required field overridden with an
// invalid value, guaranteeing exactly one known offender while the rest of
// the fields stay valid.
const envWithOneInvalidFieldArbitrary = fc
  .tuple(validEnvArbitrary, invalidFieldSelectionArb)
  .map(([validEnv, { idx, badValue }]) => {
    const fieldName = requiredFields[idx].name
    return {
      env: { ...validEnv, [fieldName]: badValue } as ChainEnv,
      offendingField: fieldName,
    }
  })

/** Extracts `invalidVariables` from an error's details, asserting the shape. */
function getInvalidVariables(error: ValidationError): string[] {
  const details = error.details as { invalidVariables?: unknown }
  expect(Array.isArray(details?.invalidVariables)).toBe(true)
  return details.invalidVariables as string[]
}

// ---------------------------------------------------------------------------
// Property 1: Chain config loads valid env and reports every offender
// otherwise.
// Validates: Requirements 1.1, 1.4, 1.5, 10.1, 10.3, 10.5
// ---------------------------------------------------------------------------

describe('Property 1: loadChainConfig loads valid env and reports every offender otherwise', () => {
  it('returns ok(...) with fields matching the input for every all-valid env', () => {
    fc.assert(
      fc.property(validEnvArbitrary, (env) => {
        const result = loadChainConfig(env)
        expect(result.isOk()).toBe(true)
        if (result.isOk()) {
          const config = result.value
          expect(config.rpcUrl).toBe(env.POLYGON_AMOY_RPC_URL)
          expect(config.deployerKey).toBe(env.DEPLOYER_PRIVATE_KEY)
          expect(config.lguAdminWallet).toBe(env.LGU_ADMIN_WALLET_ADDRESS)
          expect(config.phpcTokenAddress).toBe(env.PHPC_TOKEN_ADDRESS)
          expect(config.phpcSubsidyAddress).toBe(env.PHPC_SUBSIDY_ADDRESS)
          expect(config.keyEncryptionKey).toBe(env.CUSTODIAL_KEY_ENCRYPTION_KEY)
          expect(config.qrTokenSecret).toBe(env.QR_TOKEN_SECRET)
          expect(config.qrTokenTtlSeconds).toBe(
            env.QR_TOKEN_TTL_SECONDS ? Number(env.QR_TOKEN_TTL_SECONDS) : 300,
          )
        }
      }),
      { numRuns: 100 },
    )
  })

  it('returns err(...) naming at least the overridden offender for envs with at least one invalid field', () => {
    fc.assert(
      fc.property(envWithOneInvalidFieldArbitrary, ({ env, offendingField }) => {
        const result = loadChainConfig(env)
        expect(result.isErr()).toBe(true)
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(ValidationError)
          const invalidVariables = getInvalidVariables(result.error as ValidationError)
          expect(invalidVariables.length).toBeGreaterThan(0)
          expect(invalidVariables).toContain(offendingField)
        }
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Runtime config never targets the local Hardhat network.
// Validates: Requirements 1.8
// ---------------------------------------------------------------------------

describe('Property 2: runtime config never targets the local Hardhat network', () => {
  it('always resolves chainId 80002 and never a localhost/127.0.0.1 RPC URL for valid envs', () => {
    fc.assert(
      fc.property(validEnvArbitrary, (env) => {
        const result = loadChainConfig(env)
        if (result.isOk()) {
          expect(result.value.chainId).toBe(80002)
          expect(result.value.rpcUrl).not.toMatch(/localhost|127\.0\.0\.1/)
        }
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Unit tests: specific ChainConfig error messages
// Requirements: 1.5, 10.3, 10.5
// ---------------------------------------------------------------------------

function buildValidEnv(overrides: ChainEnv = {}): ChainEnv {
  return {
    POLYGON_AMOY_RPC_URL: 'https://rpc-amoy.example.com',
    DEPLOYER_PRIVATE_KEY: `0x${'a'.repeat(64)}`,
    LGU_ADMIN_WALLET_ADDRESS: `0x${'b'.repeat(40)}`,
    PHPC_TOKEN_ADDRESS: `0x${'c'.repeat(40)}`,
    PHPC_SUBSIDY_ADDRESS: `0x${'d'.repeat(40)}`,
    CUSTODIAL_KEY_ENCRYPTION_KEY: 'test-key-encryption-key',
    QR_TOKEN_SECRET: 'test-qr-token-secret',
    ...overrides,
  }
}

describe('loadChainConfig unit tests: specific error messages', () => {
  it('names POLYGON_AMOY_RPC_URL when the RPC URL is missing', () => {
    const result = loadChainConfig(buildValidEnv({ POLYGON_AMOY_RPC_URL: undefined }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ValidationError)
      const invalidVariables = getInvalidVariables(result.error as ValidationError)
      expect(invalidVariables).toEqual(['POLYGON_AMOY_RPC_URL'])
    }
  })

  it('names DEPLOYER_PRIVATE_KEY when the private key is malformed', () => {
    const result = loadChainConfig(buildValidEnv({ DEPLOYER_PRIVATE_KEY: '0x1234' }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      const invalidVariables = getInvalidVariables(result.error as ValidationError)
      expect(invalidVariables).toEqual(['DEPLOYER_PRIVATE_KEY'])
    }
  })

  it('names LGU_ADMIN_WALLET_ADDRESS when the address is malformed', () => {
    const result = loadChainConfig(buildValidEnv({ LGU_ADMIN_WALLET_ADDRESS: '0x1234' }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      const invalidVariables = getInvalidVariables(result.error as ValidationError)
      expect(invalidVariables).toEqual(['LGU_ADMIN_WALLET_ADDRESS'])
    }
  })

  it('names every offending variable together and excludes valid fields', () => {
    const result = loadChainConfig(
      buildValidEnv({
        POLYGON_AMOY_RPC_URL: undefined,
        DEPLOYER_PRIVATE_KEY: 'not-a-key',
        LGU_ADMIN_WALLET_ADDRESS: '0xshort',
      }),
    )
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      const invalidVariables = getInvalidVariables(result.error as ValidationError)
      expect(invalidVariables).toEqual(
        expect.arrayContaining([
          'POLYGON_AMOY_RPC_URL',
          'DEPLOYER_PRIVATE_KEY',
          'LGU_ADMIN_WALLET_ADDRESS',
        ]),
      )
      expect(invalidVariables).toHaveLength(3)
    }
  })
})
