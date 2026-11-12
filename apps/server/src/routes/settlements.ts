// BE1 owns this file. Requirements: PayPal settlement contract, section 6.
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { SettlementIdParamsSchema, SettlementListQuerySchema, ApproveSettlementDto, RejectSettlementDto } from '@bantayog/schema'
import { createServiceClient } from '../lib/supabase.js'
import { SettlementService } from '../services/settlement.service.js'
import { toSettlementInvoiceDTO } from '../dto/mappers.js'
import { errorToHttpStatus, errorToResponseBody } from '../lib/errors.js'
import type { Env } from '../types/env.js'
import type { AuthContext } from '../middleware/auth.js'

const settlementRoutes = new Hono<{ Bindings: Env; Variables: AuthContext }>()
settlementRoutes.onError((error, c) => {
  if (error instanceof HTTPException && error.status === 400) {
    return c.json({ error: 'validation', message: 'Invalid JSON request body.' }, 400)
  }
  return c.json({ error: 'internal_error', message: 'Unable to process the settlement request.' }, 500)
})
const service = () => new SettlementService(createServiceClient())

settlementRoutes.get('/', zValidator('query', SettlementListQuerySchema), async c => {
  const result = await service().list(c.req.valid('query').status)
  return result.match(
    rows => c.json(rows.map(toSettlementInvoiceDTO)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

settlementRoutes.get('/:id', zValidator('param', SettlementIdParamsSchema), async c => {
  const result = await service().get(c.req.valid('param').id)
  return result.match(
    row => c.json(toSettlementInvoiceDTO(row)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

settlementRoutes.post('/:id/approve', zValidator('param', SettlementIdParamsSchema), zValidator('json', ApproveSettlementDto), async c => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'auth', message: 'Authentication required' }, 401)
  const result = await service().approve(c.req.valid('param').id, user.id, c.req.valid('json').releaseTransactionIds)
  return result.match(
    row => c.json(toSettlementInvoiceDTO(row)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

settlementRoutes.post('/:id/reject', zValidator('param', SettlementIdParamsSchema), zValidator('json', RejectSettlementDto), async c => {
  const result = await service().reject(c.req.valid('param').id, c.req.valid('json').reason)
  return result.match(
    row => c.json(toSettlementInvoiceDTO(row)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

settlementRoutes.post('/:id/refresh', zValidator('param', SettlementIdParamsSchema), async c => {
  const result = await service().refresh(c.req.valid('param').id)
  return result.match(
    row => c.json(toSettlementInvoiceDTO(row)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})

export default settlementRoutes
