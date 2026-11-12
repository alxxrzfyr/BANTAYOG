// BE1 owns this file. Requirements: PayPal settlement contract, section 6.
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { SettlementIdParamsSchema } from '@bantayog/schema'
import { createServiceClient } from '../lib/supabase.js'
import { SettlementService } from '../services/settlement.service.js'
import { toSettlementInvoiceDTO, toMerchantSettlementOverviewDTO } from '../dto/mappers.js'
import { errorToHttpStatus, errorToResponseBody } from '../lib/errors.js'
import type { Env } from '../types/env.js'
import type { AuthContext } from '../middleware/auth.js'

const merchantSettlementRoutes = new Hono<{
  Bindings: Env
  Variables: AuthContext & { settlementService: SettlementService; settlementMerchantId: string }
}>()

merchantSettlementRoutes.use('*', async (c, next) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'auth', message: 'Authentication required' }, 401)
  const service = new SettlementService(createServiceClient())
  const merchant = await service.merchantForUser(user.id)
  if (merchant.isErr()) return c.json(errorToResponseBody(merchant.error), errorToHttpStatus(merchant.error))
  c.set('settlementService', service)
  c.set('settlementMerchantId', merchant.value)
  return next()
})

merchantSettlementRoutes.get('/', async c => {
  const result = await c.get('settlementService').overview(c.get('settlementMerchantId'))
  return result.match(
    row => c.json(toMerchantSettlementOverviewDTO(row)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

merchantSettlementRoutes.post('/', async c => {
  const result = await c.get('settlementService').propose(c.get('settlementMerchantId'))
  return result.match(
    value => c.json(toSettlementInvoiceDTO(value.invoice), value.created ? 201 : 200),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

merchantSettlementRoutes.get('/:id', zValidator('param', SettlementIdParamsSchema), async c => {
  const result = await c.get('settlementService').get(c.req.valid('param').id, c.get('settlementMerchantId'))
  return result.match(
    row => c.json(toSettlementInvoiceDTO(row)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

merchantSettlementRoutes.post('/:id/refresh', zValidator('param', SettlementIdParamsSchema), async c => {
  const result = await c.get('settlementService').refresh(c.req.valid('param').id, c.get('settlementMerchantId'))
  return result.match(
    row => c.json(toSettlementInvoiceDTO(row)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

export default merchantSettlementRoutes
