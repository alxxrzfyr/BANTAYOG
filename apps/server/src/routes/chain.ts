import { Hono } from 'hono'
import { formatUnits } from 'viem'
import { ChainClient } from '../services/chain.client.js'
import type { Env } from '../types/env.js'

const chainRoutes = new Hono<{ Bindings: Env }>()

/**
 * GET /api/chain/balance
 * Queries the Ronin blockchain (via viem) for any address's (or LGU Treasury's) PHPC balance.
 *
 * Query params:
 *   - address?: Optional wallet address. Defaults to LGU_TREASURY_ADDRESS.
 */
chainRoutes.get('/balance', async (c) => {
  const queryAddress = c.req.query('address')
  const targetAddress = queryAddress || c.env.LGU_TREASURY_ADDRESS

  if (!targetAddress) {
    return c.json({ error: 'bad_request', message: 'No target address provided and LGU_TREASURY_ADDRESS is not set' }, 400)
  }

  try {
    const chainClient = new ChainClient()
    const balanceWei = await chainClient.getBalance(targetAddress)
    const formatted = formatUnits(balanceWei, 18)

    return c.json({
      address: targetAddress,
      balance: balanceWei.toString(),
      formatted
    })
  } catch (err: any) {
    return c.json({ error: 'blockchain_query_failed', message: err.message }, 502)
  }
})

export default chainRoutes
