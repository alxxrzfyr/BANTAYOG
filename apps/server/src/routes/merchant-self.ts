/**
 * Merchant self-profile routes.
 *
 * Provides the authenticated merchant's own profile data
 * (store name, owner name, wallet address, balance, connection state, status).
 *
 * All routes require `authMiddleware` + `requireRole('merchant')`.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { verifyMessage } from 'viem'
import { createServiceClient } from '../lib/supabase.js'
import type { Env } from '../types/env.js'
import type { AuthContext } from '../middleware/auth.js'
import { BlockchainClient } from '../services/chain.client.js'
import { loadChainConfig } from '../lib/chain/config.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MerchantSelfDTO {
  id: string
  storeName: string
  ownerName: string
  walletAddress: string | null
  walletBalance: number
  connected: boolean
  status: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines whether a wallet address represents a valid connected EVM wallet.
 * A valid address is a non-empty, 42-character, 0x-prefixed hex string.
 */
export function isValidEvmAddress(address: string | null | undefined): boolean {
  if (!address || address.length === 0) return false
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Rounds a number to exactly 2 decimal places.
 */
function toTwoDecimalPlaces(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const merchantSelfRoutes = new Hono<{
  Bindings: Env
  Variables: AuthContext
}>()

/**
 * GET /api/merchants/me
 *
 * Returns the authenticated merchant's self-profile DTO.
 * - 401 if unauthenticated (handled by middleware)
 * - 403 if merchant profile not found for the authenticated user
 */
merchantSelfRoutes.get('/', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'auth', message: 'Authentication required' }, 401)
  }

  const db = createServiceClient()

  const { data: merchant, error } = await (db as any)
    .from('merchants')
    .select('id, store_name, owner_name, wallet_address, wallet_balance, status')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !merchant) {
    return c.json(
      { error: 'not_found', message: 'Merchant profile not found' },
      403,
    )
  }

  const dto: MerchantSelfDTO = {
    id: merchant.id,
    storeName: merchant.store_name,
    ownerName: merchant.owner_name,
    walletAddress: merchant.wallet_address ?? null,
    walletBalance: toTwoDecimalPlaces(Number(merchant.wallet_balance ?? 0)),
    connected: isValidEvmAddress(merchant.wallet_address),
    status: merchant.status,
  }

  return c.json(dto)
})

// ---------------------------------------------------------------------------
// Body schema for wallet connect
// ---------------------------------------------------------------------------

const walletConnectSchema = z.object({
  address: z.string(),
  message: z.string(),
  signature: z.string(),
})

/**
 * POST /api/merchants/me/wallet
 *
 * Connects a wallet to the authenticated merchant.
 * Validates the EVM address format and verifies personal_sign ownership proof.
 * - 400 if address is not a valid 42-char 0x-prefixed EVM address
 * - 400 if signature verification fails (signer != claimed address)
 * - 500 on DB persistence failure (wallet_address left unchanged)
 */
merchantSelfRoutes.post('/wallet', zValidator('json', walletConnectSchema), async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'auth', message: 'Authentication required' }, 401)
  }

  const { address, message, signature } = c.req.valid('json')

  // Validate address is a 42-char 0x-prefixed EVM hex address
  if (!isValidEvmAddress(address)) {
    return c.json(
      { error: 'validation', message: 'Invalid EVM wallet address. Must be a 42-character 0x-prefixed hex string.' },
      400,
    )
  }

  // Verify personal_sign ownership: recovered signer must equal claimed address
  try {
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })

    if (!isValid) {
      return c.json(
        { error: 'verification', message: 'Signature verification failed. The signer does not match the claimed address.' },
        400,
      )
    }
  } catch {
    return c.json(
      { error: 'verification', message: 'Signature verification failed. Invalid signature format or content.' },
      400,
    )
  }

  // Persist wallet_address on the requesting merchant's row only
  const db = createServiceClient()

  const { data: merchant, error } = await (db as any)
    .from('merchants')
    .update({ wallet_address: address })
    .eq('auth_user_id', user.id)
    .select('id, store_name, owner_name, wallet_address, wallet_balance, status')
    .single()

  if (error || !merchant) {
    return c.json(
      { error: 'persistence', message: 'Failed to persist wallet address. Please try again.' },
      500,
    )
  }

  const dto: MerchantSelfDTO = {
    id: merchant.id,
    storeName: merchant.store_name,
    ownerName: merchant.owner_name,
    walletAddress: merchant.wallet_address ?? null,
    walletBalance: toTwoDecimalPlaces(Number(merchant.wallet_balance ?? 0)),
    connected: isValidEvmAddress(merchant.wallet_address),
    status: merchant.status,
  }

  return c.json(dto)
})

/**
 * POST /api/merchants/me/cashout
 *
 * Initiates cashout of the merchant's wallet_balance to their connected wallet.
 */
merchantSelfRoutes.post('/cashout', async (c) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'auth', message: 'Authentication required' }, 401)
  }

  const db = createServiceClient()

  // Load merchant profile
  const { data: merchant, error: loadError } = await (db as any)
    .from('merchants')
    .select('id, wallet_address, wallet_balance, cashout_in_progress')
    .eq('auth_user_id', user.id)
    .single()

  if (loadError || !merchant) {
    return c.json(
      { error: 'not_found', message: 'Merchant profile not found' },
      403
    )
  }

  // Reject if no wallet connected
  if (!merchant.wallet_address || merchant.wallet_address.length === 0) {
    return c.json(
      { error: 'validation', message: 'wallet required' },
      400
    )
  }

  // Parse optional request body for destination checks
  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    // Body is optional
  }

  const destination = body?.destination || body?.address
  if (destination && destination.toLowerCase() !== merchant.wallet_address.toLowerCase()) {
    return c.json(
      { error: 'validation', message: 'Destination address does not match the registered wallet address' },
      400
    )
  }

  // Check balance
  if (Number(merchant.wallet_balance) <= 0) {
    return c.json(
      { error: 'validation', message: 'no balance to transfer' },
      400
    )
  }

  // Acquire lock
  const { data: lockedMerchant, error: lockError } = await (db as any)
    .from('merchants')
    .update({ cashout_in_progress: true })
    .eq('id', merchant.id)
    .eq('cashout_in_progress', false)
    .select('id, wallet_balance, wallet_address')
    .single()

  if (lockError || !lockedMerchant) {
    return c.json(
      { error: 'conflict', message: 'A cash-out operation is already in progress' },
      409
    )
  }

  const amount = Number(lockedMerchant.wallet_balance ?? 0)

  // Double check balance after locking
  if (amount <= 0) {
    await (db as any)
      .from('merchants')
      .update({ cashout_in_progress: false })
      .eq('id', merchant.id)

    return c.json(
      { error: 'validation', message: 'no balance to transfer' },
      400
    )
  }

  // Load chain config and client
  const configResult = loadChainConfig(process.env)
  if (configResult.isErr()) {
    await (db as any)
      .from('merchants')
      .update({ cashout_in_progress: false })
      .eq('id', merchant.id)

    return c.json({ error: 'blockchain_config', message: 'Blockchain configuration error' }, 502)
  }

  const clientResult = await BlockchainClient.create(configResult.value)
  if (clientResult.isErr()) {
    await (db as any)
      .from('merchants')
      .update({ cashout_in_progress: false })
      .eq('id', merchant.id)

    return c.json({ error: 'blockchain_client', message: 'Failed to connect to blockchain client' }, 502)
  }

  const chainClient = clientResult.value
  const amountWei = BigInt(Math.round(amount * 100)) * BigInt(10 ** 16)

  // Execute transfer
  const transferResult = await chainClient.transferPHPC(merchant.wallet_address, amountWei)
  if (transferResult.isErr()) {
    await (db as any)
      .from('merchants')
      .update({ cashout_in_progress: false })
      .eq('id', merchant.id)

    return c.json({ error: 'transfer_failed', message: transferResult.error.message }, 502)
  }

  const txHash = transferResult.value
  const receiptResult = await chainClient.waitForConfirmation(txHash, 300_000)
  if (receiptResult.isErr()) {
    await (db as any)
      .from('merchants')
      .update({ cashout_in_progress: false })
      .eq('id', merchant.id)

    return c.json({ error: 'confirmation_timeout', message: receiptResult.error.message }, 502)
  }

  // Zero balance and release lock
  const { error: finalError } = await (db as any)
    .from('merchants')
    .update({
      wallet_balance: 0,
      cashout_in_progress: false
    })
    .eq('id', merchant.id)

  if (finalError) {
    // Attempt lock release at least
    await (db as any)
      .from('merchants')
      .update({ cashout_in_progress: false })
      .eq('id', merchant.id)

    return c.json({ error: 'db_update_failed', message: 'On-chain transfer succeeded, but DB update failed.' }, 502)
  }

  return c.json({
    success: true,
    txHash,
    walletBalance: 0.00
  })
})

export default merchantSelfRoutes
