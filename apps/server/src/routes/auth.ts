import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createServiceClient } from '../lib/supabase.js'
import { PinService } from '../services/pin.service.js'
import { BeneficiaryService } from '../services/beneficiary.service.js'
import { QrTokenService } from '../services/qr-token.service.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { errorToHttpStatus, errorToResponseBody } from '../lib/errors.js'
import type { Env } from '../types/env.js'

const authRoutes = new Hono<{ Bindings: Env }>()
const pinService = new PinService()

// Validation Schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

const merchantLoginSchema = z.object({
  mobileNumberE164: z.string().min(1),
  password: z.string().min(6)
})

const walletLoginSchema = z.object({
  method: z.enum(['waypoint', 'tanto', 'injected']),
  proof: z.object({
    address: z.string(),
    message: z.string().optional(),
    signature: z.string().optional(),
    token: z.string().optional()
  })
})

const verifyPinSchema = z.object({
  beneficiaryId: z.string().uuid(),
  pin: z.string().length(6)
})

import { WalletAdapterGateway } from '../services/wallet-adapter.gateway.js'
const walletGateway = new WalletAdapterGateway()

/**
 * POST /api/auth/wallet-login
 * Authenticates merchant via Ronin Wallet signature or Waypoint token
 */
authRoutes.post('/wallet-login', zValidator('json', walletLoginSchema), async (c) => {
  const { method, proof } = c.req.valid('json')
  const db = createServiceClient()

  try {
    // 1. Verify the wallet connection
    const verifiedAddress = await walletGateway.verifyWalletConnection(method, proof)

    // 2. Query merchant profile matching this wallet address
    // Wallet addresses are stored case-insensitively/normally, let's query case-insensitively if needed
    const { data: merchant, error: dbError } = await (db as any)
      .from('merchants')
      .select('*')
      .eq('wallet_address', verifiedAddress)
      .eq('status', 'APPROVED')
      .maybeSingle()

    if (dbError || !merchant) {
      return c.json({ error: 'forbidden', message: 'Merchant wallet address not registered or not approved' }, 403)
    }

    // 3. Fetch the auth user profile to get the derived email
    const { data: userData, error: userError } = await db.auth.admin.getUserById(merchant.auth_user_id)
    if (userError || !userData?.user) {
      return c.json({ error: 'forbidden', message: 'Auth user profile not found for merchant' }, 403)
    }

    const email = userData.user.email
    if (!email) {
      return c.json({ error: 'forbidden', message: 'Email address not found on auth profile' }, 403)
    }

    // 4. Generate direct sign-in link containing the OTP code
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email
    })

    if (linkError || !linkData) {
      return c.json({ error: 'unauthorized', message: 'Failed to generate sign-in link' }, 401)
    }

    // 5. Exchange the generated OTP code for a valid user session
    const { data: sessionData, error: sessionError } = await db.auth.verifyOtp({
      email,
      token: linkData.properties.email_otp,
      type: 'magiclink'
    })

    if (sessionError || !sessionData?.session) {
      return c.json({ error: 'unauthorized', message: 'Failed to establish auth session' }, 401)
    }

    return c.json({
      user: {
        id: userData.user.id,
        email: userData.user.email,
        role: 'merchant',
        merchantId: merchant.id,
        storeName: merchant.store_name
      },
      session: {
        accessToken: sessionData.session.access_token,
        expiresAt: sessionData.session.expires_at
      }
    })
  } catch (err: any) {
    return c.json({ error: 'unauthorized', message: err.message }, 401)
  }
})


/**
 * POST /api/auth/login
 * Admin Login via Supabase Auth
 */
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const db = createServiceClient()

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return c.json({ error: 'unauthorized', message: error.message }, 401)
  }

  // Check if role is admin
  if (data.user?.app_metadata?.role !== 'admin') {
    // Attempt signout since user is not admin
    await db.auth.signOut()
    return c.json({ error: 'forbidden', message: 'User is not an LGU admin' }, 403)
  }

  return c.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: 'admin'
    },
    session: {
      accessToken: data.session?.access_token,
      expiresAt: data.session?.expires_at
    }
  })
})

/**
 * POST /api/auth/merchant-login
 * Merchant Login via Supabase Auth (email derived from mobile number)
 */
authRoutes.post('/merchant-login', zValidator('json', merchantLoginSchema), async (c) => {
  const { mobileNumberE164, password } = c.req.valid('json')
  const db = createServiceClient()

  const email = `${mobileNumberE164.replace('+', '')}@merchant.bantayog.local`;

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return c.json({ error: 'unauthorized', message: error.message }, 401)
  }

  if (!data.user?.id) {
    return c.json({ error: 'unauthorized', message: 'User session not established' }, 401)
  }

  // Fetch merchant profile
  const { data: merchant, error: dbError } = await (db as any)
    .from('merchants')
    .select('*')
    .eq('auth_user_id', data.user.id)
    .single()

  if (dbError || !merchant) {
    await db.auth.signOut()
    return c.json({ error: 'forbidden', message: 'Merchant profile not found' }, 403)
  }

  return c.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: 'merchant',
      merchantId: merchant.id,
      storeName: merchant.store_name
    },
    session: {
      accessToken: data.session?.access_token,
      expiresAt: data.session?.expires_at
    }
  })
})

/**
 * POST /api/auth/verify-pin
 * PIN verification endpoint during checkout
 */
authRoutes.post('/verify-pin', zValidator('json', verifyPinSchema), async (c) => {
  const { beneficiaryId, pin } = c.req.valid('json')
  const db = createServiceClient()

  // Fetch beneficiary pin hash from database
  const { data: beneficiary, error } = await (db as any)
    .from('beneficiaries')
    .select('*')
    .eq('id', beneficiaryId)
    .single()

  if (error || !beneficiary || !beneficiary.pin_hash_argon2id) {
    return c.json({ error: 'not_found', message: 'Beneficiary PIN record not found' }, 404)
  }

  const verifyResult = await pinService.verifyPin(pin, beneficiary.pin_hash_argon2id)

  return verifyResult.match(
    (isValid) => {
      if (!isValid) {
        return c.json({ error: 'unauthorized', message: 'Incorrect PIN' }, 401)
      }
      return c.json({ status: 'success', verified: true })
    },
    (errVal) => c.json(errorToResponseBody(errVal), errorToHttpStatus(errVal))
  )
})

const verifyQrSchema = z.object({
  token: z.string().min(1)
})

/**
 * POST /api/auth/verify-qr
 * Verifies the beneficiary QR code, performs live tier re-evaluation, and returns details.
 */
authRoutes.post('/verify-qr', zValidator('json', verifyQrSchema), async (c) => {
  const { token } = c.req.valid('json')
  const qrTokenService = new QrTokenService()
  
  const payloadResult = await qrTokenService.verifyToken(token)
  if (payloadResult.isErr()) {
    return c.json(errorToResponseBody(payloadResult.error), errorToHttpStatus(payloadResult.error))
  }
  const payload = payloadResult.value

  const db = createServiceClient()
  const beneficiaryService = new BeneficiaryService(db)

  const result = await beneficiaryService.verifyAndReevaluateTier(payload.beneficiaryId)
  return result.match(
    (res) => c.json({
      status: 'success',
      beneficiary: res.beneficiary,
      currentTier: res.tier
    }),
    (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
  )
})

/**
 * POST /api/auth/logout
 * Signs out the current Supabase session.
 */
authRoutes.post('/logout', authMiddleware, requireRole('admin', 'merchant'), async (c) => {
  const db = createServiceClient()
  const { error } = await db.auth.signOut({ scope: 'local' })

  if (error) {
    return c.json({ error: 'logout_failed', message: error.message }, 500)
  }

  return c.json({ success: true, message: 'Signed out successfully' })
})

export default authRoutes

