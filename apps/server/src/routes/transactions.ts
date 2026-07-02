import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createServiceClient } from '../lib/supabase.js'
import { TransactionService } from '../services/transaction.service.js'
import { QrTokenService } from '../services/qr-token.service.js'
import { PinService } from '../services/pin.service.js'
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
    const verifyResult = await pinService.verifyPin(pin, beneficiary.pin_hash_argon2id || '')
    if (verifyResult.isErr()) {
      return c.json(errorToResponseBody(verifyResult.error), errorToHttpStatus(verifyResult.error))
    }
    const isPinValid = verifyResult.value
    if (!isPinValid) {
      return c.json({ error: 'unauthorized', message: 'Incorrect guardian PIN' }, 401)
    }

    // 4. Calculate total credit cost and verify credit balance
    const totalCreditDeducted = items.reduce((sum, item) => sum + Number(item.creditCost), 0)
    const currentBalance = Number(beneficiary.credit_balance)
    if (currentBalance < totalCreditDeducted) {
      return c.json({ error: 'bad_request', message: 'Insufficient beneficiary credit balance' }, 400)
    }

    const transactionService = new TransactionService(db)

    // 5. Create transaction and outbox entry
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

    // 6. Deduct credit balance from beneficiary
    const { error: updateErr } = await (db as any)
      .from('beneficiaries')
      .update({ credit_balance: currentBalance - totalCreditDeducted })
      .eq('id', beneficiaryId)

    if (updateErr) {
      console.error('Failed to deduct credit balance:', updateErr)
      await transactionService.updateStatus(tx.id, 'FAILED')
      return c.json({ error: 'internal_error', message: 'Failed to complete transaction' }, 500)
    }

    return c.json(toTransactionDTO(tx), 201)
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

