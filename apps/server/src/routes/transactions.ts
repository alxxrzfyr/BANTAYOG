import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createServiceClient } from '../lib/supabase.js'
import { TransactionService } from '../services/transaction.service.js'
import { QrTokenService } from '../services/qr-token.service.js'
import { PinService } from '../services/pin.service.js'
import { BlockchainClient } from '../services/chain.client.js'
import { loadChainConfig } from '../lib/chain/config.js'
import { authMiddleware, type AuthContext } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { toTransactionDTO } from '../dto/mappers.js'
import { errorToHttpStatus, errorToResponseBody } from '../lib/errors.js'
import type { Env } from '../types/env.js'

const transactionRoutes = new Hono<{ Bindings: Env; Variables: AuthContext }>()

const NutritionCategorySchema = z.enum([
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
])

const TransactionItemSchema = z.object({
  category: NutritionCategorySchema,
  name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unitPricePhp: z.number().nonnegative(),
  creditCost: z.number().nonnegative(),
})

const createTransactionSchema = z.object({
  qrToken: z.string().min(1),
  pin: z.string().length(6),
  items: z.array(TransactionItemSchema).min(1),
  idempotencyKey: z.string().uuid(),
  photoStoragePath: z.string().optional()
})

// Apply authentication to all transaction routes
transactionRoutes.use('*', authMiddleware)

/**
 * POST /api/transactions
 * Submit a new redemption transaction.
 * Restrained to merchants.
 */
transactionRoutes.post(
  '/',
  requireRole('merchant'),
  zValidator('json', createTransactionSchema),
  async (c) => {
    const { qrToken, pin, items, idempotencyKey } = c.req.valid('json')
    const user = c.get('user')

    if (!user || user.role !== 'merchant') {
      return c.json({ error: 'unauthorized', message: 'User session not established or not a merchant' }, 401)
    }

    const db = createServiceClient()

    // 1. Fetch merchant details using auth_user_id
    const { data: merchant, error: merchantErr } = await (db as any)
      .from('merchants')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (merchantErr || !merchant) {
      return c.json({ error: 'forbidden', message: 'Merchant profile not found' }, 403)
    }

    if (merchant.status !== 'APPROVED') {
      return c.json({ error: 'forbidden', message: 'Merchant is not approved to perform transactions' }, 403)
    }

    // 2. Decode and verify the QR token
    const qrTokenService = new QrTokenService()
    const verifyTokenResult = await qrTokenService.verifyToken(qrToken)
    if (verifyTokenResult.isErr()) {
      return c.json(errorToResponseBody(verifyTokenResult.error), errorToHttpStatus(verifyTokenResult.error))
    }
    const decodedToken = verifyTokenResult.value

    const { beneficiaryId } = decodedToken

    // 3. Fetch beneficiary and verify PIN
    const { data: beneficiary, error: beneficiaryErr } = await (db as any)
      .from('beneficiaries')
      .select('*')
      .eq('id', beneficiaryId)
      .single()

    if (beneficiaryErr || !beneficiary) {
      return c.json({ error: 'not_found', message: 'Beneficiary not found' }, 404)
    }

    const pinService = new PinService()
    // Requirements 7.3, 7.4, 7.5: lockout check happens inside
    // verifyPinWithLockout BEFORE the PIN is attempted, and any error
    // (including RateLimitError on lockout) is already mapped correctly by
    // errorToHttpStatus (rateLimit -> 429).
    const verifyResult = await pinService.verifyPinWithLockout(beneficiaryId, pin, beneficiary.pin_hash_argon2id || '')
    if (verifyResult.isErr()) {
      return c.json(errorToResponseBody(verifyResult.error), errorToHttpStatus(verifyResult.error))
    }
    const isPinValid = verifyResult.value
    if (!isPinValid) {
      return c.json({ error: 'unauthorized', message: 'Incorrect guardian PIN' }, 401)
    }

    // 4. Calculate total credit cost and verify amount/credit balance
    const totalCreditDeducted = items.reduce((sum, item) => sum + Number(item.creditCost), 0)

    // Requirement 7.9: reject non-positive purchase amounts before any balance check.
    if (totalCreditDeducted <= 0) {
      return c.json({ error: 'validation', message: 'Purchase amount must be greater than zero' }, 400)
    }

    const currentBalance = Number(beneficiary.credit_balance)
    // Requirement 7.7: reject over-balance purchases without mutating the balance.
    if (currentBalance < totalCreditDeducted) {
      return c.json({ error: 'bad_request', message: 'Insufficient beneficiary credit balance' }, 400)
    }

    const transactionService = new TransactionService(db)

    // 5. Settle on-chain BEFORE persisting anything or deducting balance
    // (Requirements 7.6, 7.8): load chain config, construct the blockchain
    // client, transfer PHPC to the merchant wallet, and wait for
    // confirmation. Nothing is mutated until this succeeds.
    const chainConfigResult = loadChainConfig(process.env)
    if (chainConfigResult.isErr()) {
      return c.json(errorToResponseBody(chainConfigResult.error), errorToHttpStatus(chainConfigResult.error))
    }

    const clientResult = await BlockchainClient.create(chainConfigResult.value)
    if (clientResult.isErr()) {
      return c.json(errorToResponseBody(clientResult.error), errorToHttpStatus(clientResult.error))
    }
    const chainClient = clientResult.value

    // Convert credits to base units (1 credit = 1 PHPC = 10^18 wei), matching
    // the same whole-number-credit convention used by
    // TransactionService.createTransaction's stablecoinAmountWei conversion.
    const amountWei = BigInt(totalCreditDeducted) * BigInt(10 ** 18)

    const transferResult = await chainClient.transferPHPC(merchant.wallet_address, amountWei)
    if (transferResult.isErr()) {
      return c.json(errorToResponseBody(transferResult.error), errorToHttpStatus(transferResult.error))
    }
    const onchainTxHash = transferResult.value

    const confirmResult = await chainClient.waitForConfirmation(onchainTxHash)
    if (confirmResult.isErr()) {
      return c.json(errorToResponseBody(confirmResult.error), errorToHttpStatus(confirmResult.error))
    }

    // 6. Only after on-chain confirmation succeeds: persist the
    // Transaction_Record (Requirement 7.8) reflecting the already-confirmed
    // on-chain state.
    const txResult = await transactionService.createTransaction({
      beneficiaryId,
      merchantId: merchant.id,
      items,
      idempotencyKey
    })

    if (txResult.isErr()) {
      return c.json(errorToResponseBody(txResult.error), errorToHttpStatus(txResult.error))
    }
    const tx = txResult.value

    const confirmedAt = new Date().toISOString()
    await transactionService.updateStatus(tx.id, 'CONFIRMED', {
      onchainTxHash,
      confirmedAt
    })

    // 7. Deduct credit balance from beneficiary — moved to run AFTER
    // on-chain confirmation (Requirement 7.6).
    const { error: updateErr } = await (db as any)
      .from('beneficiaries')
      .update({ credit_balance: currentBalance - totalCreditDeducted })
      .eq('id', beneficiaryId)

    if (updateErr) {
      // The on-chain transfer already succeeded at this point, so this is a
      // reconciliation-worthy inconsistency (money moved on-chain but the
      // off-chain ledger did not update) rather than a simple failed
      // purchase. This known gap is left for the reconcile.ts cron / a
      // manual ops process to catch; a full distributed-transaction fix is
      // out of scope for this task (see Requirement 7.10 / Task 11.3).
      console.error('On-chain transfer succeeded but balance deduction failed (reconciliation required):', {
        transactionId: tx.id,
        beneficiaryId,
        onchainTxHash,
        error: updateErr
      })
      await transactionService.updateStatus(tx.id, 'FAILED')
      return c.json({ error: 'internal_error', message: 'Failed to complete transaction' }, 500)
    }

    return c.json(toTransactionDTO({ ...tx, status: 'CONFIRMED', onchain_tx_hash: onchainTxHash, confirmed_at: confirmedAt }), 201)
  }
)

/**
 * GET /api/transactions
 * Retrieve transaction history. Accessible to admin and merchant.
 */
transactionRoutes.get(
  '/',
  requireRole('admin', 'merchant'),
  async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'unauthorized', message: 'Authentication required' }, 401)

    const db = createServiceClient()
    const transactionService = new TransactionService(db)

    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const status = c.req.query('status') as any

    let merchantId = c.req.query('merchantId')
    const beneficiaryId = c.req.query('beneficiaryId')

    // If merchant role, restrict results to their own transactions
    if (user.role === 'merchant') {
      const { data: merchant, error: mErr } = await (db as any)
        .from('merchants')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (mErr || !merchant) {
        return c.json({ error: 'forbidden', message: 'Merchant profile not found' }, 403)
      }
      merchantId = merchant.id
    }

    const result = await transactionService.listTransactions({
      merchantId,
      beneficiaryId,
      status,
      page,
      limit
    })

    return result.match(
      (res) => c.json({
        data: res.data.map(toTransactionDTO),
        count: res.count
      }),
      (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
    )
  }
)

/**
 * GET /api/transactions/:id
 * Retrieve detail of a single transaction.
 */
transactionRoutes.get(
  '/:id',
  requireRole('admin', 'merchant'),
  async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')
    if (!user) return c.json({ error: 'unauthorized', message: 'Authentication required' }, 401)

    const db = createServiceClient()
    const transactionService = new TransactionService(db)

    const txResult = await transactionService.getTransaction(id)

    return txResult.match(
      async (tx) => {
        // If merchant role, check that they own the transaction
        if (user.role === 'merchant') {
          const { data: merchant, error: mErr } = await (db as any)
            .from('merchants')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

          if (mErr || !merchant || tx.merchant_id !== merchant.id) {
            return c.json({ error: 'forbidden', message: 'You do not have access to this transaction' }, 403)
          }
        }

        return c.json(toTransactionDTO(tx))
      },
      (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
    )
  }
)

export default transactionRoutes

