// BE1 owns this file. Requirements: PayPal fund contract.
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { bodyLimit } from 'hono/body-limit'
import { zValidator } from '@hono/zod-validator'
import { CreateFundTopupDto, FundOrderParamsSchema } from '@bantayog/schema'
import { createServiceClient } from '../lib/supabase.js'
import { FundService } from '../services/fund.service.js'
import { toFundTopupDTO, toFundLedgerDTO } from '../dto/mappers.js'
import { errorToHttpStatus, errorToResponseBody } from '../lib/errors.js'
import { authMiddleware, type AuthContext } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import type { Env } from '../types/env.js'

const fundRoutes = new Hono<{ Bindings: Env; Variables: AuthContext }>()
const service = () => new FundService(createServiceClient())
fundRoutes.onError((error, c) => error instanceof HTTPException && error.status === 400
  ? c.json({ error: 'validation', message: 'Invalid JSON request body.' }, 400)
  : c.json({ error: 'internal_error', message: 'Unable to process the contribution request.' }, 500))
fundRoutes.use('*', bodyLimit({ maxSize: 1024, onError: c => c.json({ error: 'validation', message: 'Request body is too large.' }, 413) }))

// A guest can approve only a server-created sandbox order. No payer data is returned.
fundRoutes.post('/topups', zValidator('json', CreateFundTopupDto), async c => {
  const result = await service().create(c.req.valid('json'))
  return result.match(
    data => c.json(toFundTopupDTO(data.topup, data.approvalUrl)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})
fundRoutes.post('/topups/:orderId/capture', zValidator('param', FundOrderParamsSchema), async c => {
  const result = await service().capture(c.req.valid('param').orderId)
  return result.match(
    data => c.json(toFundTopupDTO(data.topup)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})
fundRoutes.use('/ledger', authMiddleware, requireRole('admin'))
fundRoutes.get('/ledger', async c => {
  const result = await service().ledger()
  return result.match(
    data => c.json(toFundLedgerDTO(data)),
    error => c.json(errorToResponseBody(error), errorToHttpStatus(error)),
  )
})
export default fundRoutes
