import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { CreateBeneficiaryDto } from '@bantayog/schema'
import { createServiceClient } from '../lib/supabase.js'
import { BeneficiaryService } from '../services/beneficiary.service.js'
import { ChainClient } from '../services/chain.client.js'
import { toBeneficiaryDTO } from '../dto/mappers.js'
import { formatUnits } from 'viem'
import { errorToHttpStatus, errorToResponseBody } from '../lib/errors.js'
import type { Env } from '../types/env.js'

const beneficiaryRoutes = new Hono<{ Bindings: Env }>()

// Validation Schema for Credits top-up
const addCreditsSchema = z.object({
  amount: z.number().positive()
})

/**
 * POST /api/beneficiaries/register
 * Onboard a new beneficiary and generate QR Voucher/Pass
 */
beneficiaryRoutes.post('/register', zValidator('json', CreateBeneficiaryDto), async (c) => {
  const dto = c.req.valid('json')
  const db = createServiceClient()
  const service = new BeneficiaryService(db)

  const result = await service.register({
    guardianName: dto.guardianName,
    guardianMobileHash: dto.guardianMobileHash,
    childName: dto.childName,
    childAgeMonths: dto.childAgeMonths,
    monthlyIncomePhp: dto.monthlyIncomePhp,
    gpsLat: dto.gpsLat,
    gpsLng: dto.gpsLng,
    pin: dto.pin
  })

  return result.match(
    (res) => c.json({
      beneficiary: toBeneficiaryDTO({ ...res.beneficiary, tier: res.tier }),
      qrToken: res.qrToken,
      cardSerial: res.cardSerial
    }, 201),
    (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
  )
})

/**
 * GET /api/beneficiaries
 * Fetch paginated active beneficiaries directory
 */
beneficiaryRoutes.get('/', async (c) => {
  const db = createServiceClient()
  const service = new BeneficiaryService(db)

  const page = Number(c.req.query('page') || '1')
  const limit = Number(c.req.query('limit') || '20')

  const result = await service.list(page, limit)

  return result.match(
    (res) => c.json({
      data: res.data.map(toBeneficiaryDTO),
      count: res.count
    }),
    (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
  )
})

/**
 * PATCH /api/beneficiaries/:id/credits
 * Top-up credits with LGU balance pre-flight check
 */
beneficiaryRoutes.patch('/:id/credits', zValidator('json', addCreditsSchema), async (c) => {
  const id = c.req.param('id')
  const { amount } = c.req.valid('json')
  const db = createServiceClient()
  const service = new BeneficiaryService(db)

  try {
    // 1. Fetch LGU balance from blockchain
    const chainClient = new ChainClient()
    const lguTreasury = c.env.LGU_TREASURY_ADDRESS || process.env.LGU_TREASURY_ADDRESS
    if (!lguTreasury) {
      return c.json({ error: 'config', message: 'LGU_TREASURY_ADDRESS not set' }, 500)
    }
    const lguBalanceWei = await chainClient.getBalance(lguTreasury)
    const lguBalance = Number(formatUnits(lguBalanceWei, 18))

    // 2. Validate sufficient LGU balance
    if (lguBalance < amount) {
      return c.json({
        error: 'insufficient_funds',
        message: `Insufficient LGU treasury balance. Required: ${amount} PHPC, Available: ${lguBalance} PHPC`
      }, 422)
    }

    // 3. Add credits
    const result = await service.addCredits(id, amount)
    return result.match(
      (updated) => c.json(toBeneficiaryDTO(updated)),
      (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
    )
  } catch (err: any) {
    return c.json({ error: 'topup_failed', message: err.message }, 500)
  }
})

/**
 * GET /api/beneficiaries/metrics
 * Dashboard aggregates: total beneficiaries, critical units, allocated PHPC, verified merchants.
 */
beneficiaryRoutes.get('/metrics', async (c) => {
  const db = createServiceClient()
  const service = new BeneficiaryService(db)

  const result = await service.getMetrics()

  return result.match(
    (metrics) => c.json(metrics),
    (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
  )
})

export default beneficiaryRoutes

