/**
 * @bantayog/server — Vercel serverless entry point.
 *
 * Exports the Hono app for Vercel's Node.js serverless runtime.
 * Local dev runs via `pnpm dev` which uses @hono/node-server.
 */
import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = Number(process.env.PORT ?? 3001)

// For local development, start the Node.js HTTP server.
// On Vercel, the app is imported and handled by the platform.
if (process.env.NODE_ENV !== 'production') {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`BANTAYOG server running on http://localhost:${info.port}`)
  })
}

export default app
export { app }
