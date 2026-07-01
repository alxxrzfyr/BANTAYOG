import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { CreateBeneficiaryDto } from '@bantayog/schema'
import { createServiceClient } from '../lib/supabase.js'
import { BeneficiaryService } from '../services/beneficiary.service.js'
import { ChainClient } from '../services/chain.client.js'
import { toBeneficiaryDTO } from '../dto/mappers.js'
import { formatUnits } from 'viem'
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

  try {
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

    return c.json({
      beneficiary: toBeneficiaryDTO({ ...result.beneficiary, tier: result.tier }),
      qrToken: result.qrToken,
      cardSerial: result.cardSerial
    }, 201)
  } catch (err: any) {
    return c.json({ error: 'registration_failed', message: err.message }, 500)
  }
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

  try {
    const result = await service.list(page, limit)
    return c.json({
      data: result.data.map(toBeneficiaryDTO),
      count: result.count
    })
  } catch (err: any) {
    return c.json({ error: 'list_failed', message: err.message }, 500)
  }
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
    const lguBalanceWei = await chainClient.getBalance(c.env.LGU_TREASURY_ADDRESS)
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
    return c.json(toBeneficiaryDTO(result))
  } catch (err: any) {
    return c.json({ error: 'topup_failed', message: err.message }, 500)
  }
})

export default beneficiaryRoutes
