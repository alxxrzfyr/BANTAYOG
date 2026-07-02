/**
 * @bantayog/server — Vercel serverless entry point.
 *
 * Exports the Hono app for Vercel's Node.js serverless runtime.
 * Local dev runs via `pnpm dev` which uses @hono/node-server.
 */
import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = Number(process.env.PORT ?? 3001)

// Start the Node.js HTTP server for Railway/local development
serve({ fetch: app.fetch, port }, async (info) => {
  console.log(`BANTAYOG server running on http://localhost:${info.port}`)
  
  // Start the on-chain event listener
  try {
    const { startChainEventListener } = await import('./services/event-listener.js')
    startChainEventListener()
  } catch (err) {
    console.error('Failed to start blockchain event listener:', err)
  }
})

export default app
export { app }

