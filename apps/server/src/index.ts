// @bantayog/server — Vercel serverless entry point.
// Exports the Hono app for Vercel's Node.js serverless runtime.
// Local dev runs via `pnpm dev` which uses @hono/node-server.
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { runReconciliation } from './cron/reconcile.js'
import { logger } from './lib/logger.js'

const port = Number(process.env.PORT ?? 3001)

// Start the Node.js HTTP server for Railway/local development
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`BANTAYOG server running on http://localhost:${info.port}`)
})

// Drain the settlement outbox from inside the server process.
//
// `POST /api/cron/reconcile` stays the external entry point, but nothing was
// calling it: `scripts/setup-external-cron.sh` needs a cron-job.org API key
// that is not configured, and Render's own cron jobs are a paid add-on. A
// sale therefore sat at PENDING_CHAIN until someone triggered the route by
// hand, so the merchant's wallet card kept reading 0 from Horizon long after
// checkout completed.
//
// Set `RECONCILE_INTERVAL_MS=0` to disable this and drive the route
// externally instead. The default tick is deliberately short: the wallet card
// reads its balance live from Horizon, so this interval is what the cashier
// actually waits through after a sale.
//
// `runReconciliation` returns rather than throws when the chain config is
// missing, so a misconfigured deploy idles instead of crash-looping. The
// overlap guard matters because reconciliation submits Stellar payments
// serially to avoid sequence-number collisions (risk R3) — two concurrent
// runs would fight over the same beneficiary sequence.
const reconcileIntervalMs = Number(process.env.RECONCILE_INTERVAL_MS ?? 10_000)

if (reconcileIntervalMs > 0) {
  const schedulerLogger = logger.child({ requestId: 'cron-scheduler' })
  let running = false

  const timer = setInterval(() => {
    if (running) return
    running = true
    runReconciliation()
      .then((result) => {
        if (result.processed > 0 || result.failed > 0) {
          schedulerLogger.info({ ...result, msg: 'Reconciliation tick' })
        }
      })
      .catch((error: unknown) => {
        schedulerLogger.error({
          msg: 'Reconciliation tick threw',
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        running = false
      })
  }, reconcileIntervalMs)

  timer.unref()
  console.log(`Reconciliation scheduler running every ${reconcileIntervalMs}ms`)
}

export default app
export { app }

