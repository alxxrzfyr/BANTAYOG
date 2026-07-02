import { Hono } from 'hono'
import { runTierReevaluation } from '../../cron/tier-reeval.js'
import type { Env } from '../../types/env.js'

const tierReevalRoute = new Hono<{ Bindings: Env }>()

tierReevalRoute.post('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  const expectedSecret = process.env.CRON_SECRET || c.env.CRON_SECRET

  if (!expectedSecret) {
    return c.json({ error: 'config', message: 'CRON_SECRET is not configured on server' }, 500)
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return c.json({ error: 'unauthorized', message: 'Unauthorized access' }, 401)
  }

  try {
    const result = await runTierReevaluation()
    return c.json({ success: true, result })
  } catch (error: any) {
    return c.json({ error: 'worker_failed', message: error.message }, 500)
  }
})

export default tierReevalRoute
