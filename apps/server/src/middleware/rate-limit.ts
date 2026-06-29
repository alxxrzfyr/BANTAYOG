/**
 * Rate-limit middleware — Upstash sliding window.
 *
 * BE1 owns this file. Provides per-identifier rate limiting using
 * @upstash/ratelimit. The full configuration (PIN brute-force, Gemini RPM)
 * is wired up in P5 (T-5.3).
 *
 * For P1, this is a baseline stub that passes through if Upstash is not configured.
 */
import { createMiddleware } from 'hono/factory'
import type { Env } from '../types/env.js'

/**
 * Creates a rate-limit middleware for a specific limiter.
 *
 * @param limiterName - identifier for the limiter (e.g. 'pin', 'gemini')
 * @param limit - max requests per window
 * @param windowSeconds - window size in seconds
 *
 * @example
 *   app.post('/api/transactions', rateLimit('txn', 20, 60), handler)
 */
export function rateLimit(_limiterName: string, _limit: number, _windowSeconds: number) {
  return createMiddleware<{ Bindings: Env }>(async (_c, next) => {
    // P1 stub: pass through if Upstash is not configured.
    // Full implementation with @upstash/ratelimit comes in P5 (T-5.3).
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!upstashUrl || !upstashToken) {
      await next()
      return
    }

    // TODO(P5/T-5.3): Wire up @upstash/ratelimit sliding window
    // const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: slidingWindow(limit, `${windowSeconds}s`) })
    // const identifier = c.get('user')?.id ?? c.req.header('x-forwarded-for') ?? 'anonymous'
    // const { success, reset } = await ratelimit.limit(`${limiterName}:${identifier}`)
    // if (!success) return c.json({ error: 'rateLimit', message: 'Too many requests', retryAfter: Math.ceil((reset - Date.now()) / 1000) }, 429)

    await next()
  })
}
