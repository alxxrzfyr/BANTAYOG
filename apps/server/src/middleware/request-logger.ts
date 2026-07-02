import { createMiddleware } from 'hono/factory'
import { logger } from '../lib/logger.js'
import type { Env } from '../types/env.js'

export interface RequestLoggerContext {
  requestId: string
}

export const requestLogger = createMiddleware<{
  Bindings: Env
  Variables: RequestLoggerContext
}>(async (c, next) => {
  const requestId = crypto.randomUUID()
  c.set('requestId', requestId)
  c.header('X-Request-Id', requestId)

  const method = c.req.method
  const path = c.req.path
  const start = Date.now()

  // Use a child logger specifically for this request
  const requestLoggerInstance = logger.child({ requestId })
  requestLoggerInstance.info({ method, path, msg: 'Request started' })

  // Attach a helper to the context for other handlers/services to use structured logging
  // by passing the request ID
  await next()

  const durationMs = Date.now() - start
  const status = c.res.status

  requestLoggerInstance.info({
    method,
    path,
    status,
    durationMs,
    msg: 'Request completed'
  })
})
