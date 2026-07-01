/**
 * Hono app factory + middleware stack.
 *
 * Middleware order (per BANTAYOG_PROJECT_PLAN.md §9):
 *   1. CORS     — permissive for dev, locked for prod
 *   2. Logger   — structured pino request logging
 *   3. Auth     — verify Supabase JWT (skip for /health and public routes)
 *   4. RBAC     — role-based access control (applied per-route-group)
 *   5. RateLimit — Upstash sliding window (applied per-route-group)
 *
 * BE1 owns this file.
 */
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import type { Env } from './types/env.js'

// ---------------------------------------------------------------------------
// App creation
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>()

// --- Global middleware ---

// CORS: permissive in dev; tighten for production via env
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

// Logger: Hono built-in request logger (pino structured logging added in P5)
app.use('*', logger())

// --- Health check (public, no auth required) ---
/**
 * GET /health
 *
 * Returns 200 with a simple status payload. Used by:
 * - Vercel deployment health checks
 * - P1 DoD: `curl localhost:3001/health` returns 200
 * - Docker/load-balancer liveness probes
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'bantayog-server',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})

// --- Middleware stack (scaffolded, wired per-route-group in P2+) ---
// The following middleware factories are defined and ready for use:
//   - authMiddleware  (src/middleware/auth.ts)    — verifies Supabase JWT
//   - requireRole     (src/middleware/rbac.ts)     — role-based access control
//   - rateLimit       (src/middleware/rate-limit.ts) — Upstash sliding window
// They are applied per-route-group, not globally, because /health must remain public.
// Example wiring in P2:
//   app.post('/api/beneficiaries', authMiddleware, requireRole('admin'), handler)

// --- Route groups ---
import authRoutes from './routes/auth.js'
import beneficiaryRoutes from './routes/beneficiaries.js'
import merchantRoutes from './routes/merchants.js'
import chainRoutes from './routes/chain.js'
import productRoutes from './routes/products.js'
import visionRoutes from './routes/vision.js'
import transactionRoutes from './routes/transactions.js'

app.route('/api/auth', authRoutes)
app.route('/api/beneficiaries', beneficiaryRoutes)
app.route('/api/merchants', merchantRoutes)
app.route('/api/chain', chainRoutes)
app.route('/api/products', productRoutes)
app.route('/api/vision', visionRoutes)
app.route('/api/transactions', transactionRoutes)

// --- 404 fallback ---
app.notFound((c) => {
  return c.json({ error: 'not_found', message: 'Route not found' }, 404)
})

// --- Global error handler ---
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json(
    {
      error: 'internal_error',
      message: 'An unexpected error occurred',
    },
    500,
  )
})

export { app }
