import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { CreateMerchantDto } from '@bantayog/schema'
import { createServiceClient } from '../lib/supabase.js'
import { MerchantService } from '../services/merchant.service.js'
import { toMerchantDTO } from '../dto/mappers.js'
import type { Env } from '../types/env.js'

const merchantRoutes = new Hono<{ Bindings: Env }>()

// Extend CreateMerchantDto schema to require password for registration
const registerMerchantSchema = CreateMerchantDto.extend({
  password: z.string().min(6)
})

/**
 * POST /api/merchants/register
 * Onboards a new merchant and registers them in Supabase Auth & DB
 */
merchantRoutes.post('/register', zValidator('json', registerMerchantSchema), async (c) => {
  const dto = c.req.valid('json')
  const db = createServiceClient()
  const service = new MerchantService(db)

  try {
    const result = await service.register({
      storeName: dto.storeName,
      ownerName: dto.ownerName,
      mobileNumberE164: dto.mobileNumberE164,
      walletAddress: dto.walletAddress,
      password: dto.password
    })

    return c.json(toMerchantDTO(result), 201)
  } catch (err: any) {
    return c.json({ error: 'registration_failed', message: err.message }, 500)
  }
})

/**
 * GET /api/merchants
 * Lists all registered merchants (admin view)
 */
merchantRoutes.get('/', async (c) => {
  const db = createServiceClient()
  const service = new MerchantService(db)

  const page = Number(c.req.query('page') || '1')
  const limit = Number(c.req.query('limit') || '20')

  try {
    const result = await service.list(page, limit)
    return c.json({
      data: result.data.map(toMerchantDTO),
      count: result.count
    })
  } catch (err: any) {
    return c.json({ error: 'list_failed', message: err.message }, 500)
  }
})

export default merchantRoutes
