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
beneficiaryRoutes.post('/register', zValidator('json', CreateBeneficiaryDto, (result, c) => {
  if (!result.success) {
    const errorMsg = result.error?.issues
      ? result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      : (result.error?.message ?? 'Invalid request body');
    return c.json({
      error: 'validation_failed',
      message: errorMsg
    }, 400)
  }
}), async (c) => {
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
    (res) => {
      const tierLabel = res.tier === 1 ? "TIER_1_CRITICAL" : "TIER_2_STANDARD";
      const alert_banner = res.tier === 1
        ? "Critical 1,000-Day Window: Beneficiary placed in Tier 1. Core nutritional subsidies allocated."
        : "Standard Intervention: Beneficiary placed in Tier 2 (Child is over 2 years old). Standard subsidy allocated.";

      return c.json({
        beneficiary: toBeneficiaryDTO({ ...res.beneficiary, tier: res.tier }),
        qrToken: res.qrToken,
        cardSerial: res.cardSerial,
        tier: tierLabel,
        alert_banner
      }, 201);
    },
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

  const result = await service.addCredits(id, amount)
  return result.match(
    (updated) => c.json(toBeneficiaryDTO(updated)),
    (error) => c.json(errorToResponseBody(error), errorToHttpStatus(error))
  )
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

