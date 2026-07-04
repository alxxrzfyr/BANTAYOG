/**
 * Polygon Amoy chain configuration loading and validation.
 *
 * Per the polygon-amoy-phpc-migration design (`ChainConfig`, Components and
 * Interfaces §1): centralizes all Polygon Amoy configuration reading and
 * validation, replacing ad-hoc `process.env` reads scattered through the
 * blockchain client. Every required variable is validated together and every
 * offending variable is named in a single error — no partial config is ever
 * returned.
 *
 * Requirements: 1.1, 1.4, 1.5, 1.8, 10.1, 10.2, 10.3, 10.5
 */
import { type AppResult, ValidationError, ok, err } from '../errors'

/** Polygon Amoy testnet chain ID. The system never targets anything else. */
export const POLYGON_AMOY_CHAIN_ID = 80002 as const

export interface ChainConfig {
  /** POLYGON_AMOY_RPC_URL — non-empty http/https JSON-RPC endpoint. */
  rpcUrl: string
  /** Fixed at 80002; never chain ID 31337 (local Hardhat). */
  chainId: 80002
  /** DEPLOYER_PRIVATE_KEY — 0x-prefixed 64-hex private key. */
  deployerKey: `0x${string}`
  /** LGU_ADMIN_WALLET_ADDRESS — 0x-prefixed 40-hex EVM address. */
  lguAdminWallet: `0x${string}`
  /** PHPC_TOKEN_ADDRESS — 0x-prefixed 40-hex EVM address. */
  phpcTokenAddress: `0x${string}`
  /** PHPC_SUBSIDY_ADDRESS — 0x-prefixed 40-hex EVM address. */
  phpcSubsidyAddress: `0x${string}`
  /** CUSTODIAL_KEY_ENCRYPTION_KEY — sourced separately from encrypted data. */
  keyEncryptionKey: string
  /** QR_TOKEN_SECRET — HS256 signing secret. */
  qrTokenSecret: string
  /** QR_TOKEN_TTL_SECONDS — positive integer seconds; defaults to 300. */
  qrTokenTtlSeconds: number
}

/** Loose env shape accepted by {@link loadChainConfig}. */
export type ChainEnv = Partial<Record<string, string | undefined>>

// ---------------------------------------------------------------------------
// Validators (Requirements 1.1, 1.4, 10.3)
// ---------------------------------------------------------------------------

/**
 * True when `v` is a non-empty http/https URL.
 *
 * Rejects `localhost`/`127.0.0.1` hosts. There is no way to detect chain ID
 * 31337 from a URL string alone (Hardhat's default local RPC only ever
 * exposes the endpoint, not the chain ID, without a network round trip), so
 * rejecting localhost/127.0.0.1 endpoints here is the enforceable proxy for
 * Requirement 1.8's "no local Hardhat network" rule at the config layer.
 */
export function isHttpUrl(v: string): boolean {
  if (!v) return false
  let parsed: URL
  try {
    parsed = new URL(v)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return false
  return true
}

/** True when `v` is a 0x-prefixed 40-hex-character EVM address. */
export function isEvmAddress(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v)
}

/** True when `v` is a 0x-prefixed 64-hex-character EVM private key. */
export function isEvmPrivateKey(v: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(v)
}

// ---------------------------------------------------------------------------
// loadChainConfig (Requirements 1.1, 1.4, 1.5, 1.8, 10.1, 10.2, 10.3, 10.5)
// ---------------------------------------------------------------------------

const DEFAULT_QR_TOKEN_TTL_SECONDS = 300

/**
 * Loads and validates every Polygon Amoy configuration variable from `env`.
 *
 * Collects and reports EVERY offending variable in a single error — missing,
 * empty, or malformed variables never short-circuit the check for the rest.
 * No partial `ChainConfig` is ever returned; either all variables are valid
 * and a complete config is returned, or none of the fields are applied.
 *
 * Requirements: 1.1, 1.4, 1.5, 1.8, 10.1, 10.2, 10.3, 10.5
 */
export function loadChainConfig(env: ChainEnv): AppResult<ChainConfig> {
  const errors: string[] = []

  const rpcUrl = env.POLYGON_AMOY_RPC_URL
  const deployerKey = env.DEPLOYER_PRIVATE_KEY
  const lguAdminWallet = env.LGU_ADMIN_WALLET_ADDRESS
  const phpcTokenAddress = env.PHPC_TOKEN_ADDRESS
  const phpcSubsidyAddress = env.PHPC_SUBSIDY_ADDRESS
  const keyEncryptionKey = env.CUSTODIAL_KEY_ENCRYPTION_KEY
  const qrTokenSecret = env.QR_TOKEN_SECRET
  const qrTokenTtlRaw = env.QR_TOKEN_TTL_SECONDS

  if (!rpcUrl) {
    errors.push('POLYGON_AMOY_RPC_URL')
  } else if (!isHttpUrl(rpcUrl)) {
    errors.push('POLYGON_AMOY_RPC_URL')
  }

  if (!deployerKey) {
    errors.push('DEPLOYER_PRIVATE_KEY')
  } else if (!isEvmPrivateKey(deployerKey)) {
    errors.push('DEPLOYER_PRIVATE_KEY')
  }

  if (!lguAdminWallet) {
    errors.push('LGU_ADMIN_WALLET_ADDRESS')
  } else if (!isEvmAddress(lguAdminWallet)) {
    errors.push('LGU_ADMIN_WALLET_ADDRESS')
  }

  if (!phpcTokenAddress) {
    errors.push('PHPC_TOKEN_ADDRESS')
  } else if (!isEvmAddress(phpcTokenAddress)) {
    errors.push('PHPC_TOKEN_ADDRESS')
  }

  if (!phpcSubsidyAddress) {
    errors.push('PHPC_SUBSIDY_ADDRESS')
  } else if (!isEvmAddress(phpcSubsidyAddress)) {
    errors.push('PHPC_SUBSIDY_ADDRESS')
  }

  if (!keyEncryptionKey) {
    errors.push('CUSTODIAL_KEY_ENCRYPTION_KEY')
  }

  if (!qrTokenSecret) {
    errors.push('QR_TOKEN_SECRET')
  }

  // QR_TOKEN_TTL_SECONDS is optional; when present it must be a positive
  // integer, otherwise it is treated as an offending variable too.
  let qrTokenTtlSeconds = DEFAULT_QR_TOKEN_TTL_SECONDS
  if (qrTokenTtlRaw !== undefined && qrTokenTtlRaw !== '') {
    const parsed = Number(qrTokenTtlRaw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.push('QR_TOKEN_TTL_SECONDS')
    } else {
      qrTokenTtlSeconds = parsed
    }
  }

  if (errors.length > 0) {
    return err(
      new ValidationError('Invalid Polygon Amoy configuration', {
        invalidVariables: errors,
      }),
    )
  }

  return ok({
    rpcUrl: rpcUrl as string,
    chainId: POLYGON_AMOY_CHAIN_ID,
    deployerKey: deployerKey as `0x${string}`,
    lguAdminWallet: lguAdminWallet as `0x${string}`,
    phpcTokenAddress: phpcTokenAddress as `0x${string}`,
    phpcSubsidyAddress: phpcSubsidyAddress as `0x${string}`,
    keyEncryptionKey: keyEncryptionKey as string,
    qrTokenSecret: qrTokenSecret as string,
    qrTokenTtlSeconds,
  })
}
