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
    const { loadChainConfig } = await import('./lib/chain/config.js')
    const { BlockchainClient } = await import('./services/chain.client.js')
    const { startChainEventListener } = await import('./services/event-listener.js')

    const configResult = loadChainConfig(process.env)
    if (configResult.isErr()) {
      console.error('Failed to start blockchain event listener: invalid chain config', configResult.error)
    } else {
      const clientResult = await BlockchainClient.create(configResult.value)
      if (clientResult.isErr()) {
        console.error('Failed to start blockchain event listener:', clientResult.error)
      } else {
        startChainEventListener(clientResult.value)
      }
    }
  } catch (err) {
    console.error('Failed to start blockchain event listener:', err)
  }
})

export default app
export { app }

