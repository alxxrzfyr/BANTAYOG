import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { formatUnits, parseUnits } from 'viem'
import { ChainClient } from '../services/chain.client.js'
import { createServiceClient } from '../lib/supabase.js'
import type { Env } from '../types/env.js'

const chainRoutes = new Hono<{ Bindings: Env; Variables: { user?: { id: string; email: string; role: string } | null } }>()

const transferSchema = z.object({
  to: z.string().startsWith('0x').length(42, 'Invalid Ethereum address'),
  amount: z.number().positive('Amount must be positive'),
})

/**
 * GET /api/chain/balance
 * Queries the Ronin blockchain (via viem) for any address's (or LGU Treasury's) PHPC balance.
 *
 * Query params:
 *   - address?: Optional wallet address. Defaults to LGU_TREASURY_ADDRESS.
 */
chainRoutes.get('/balance', async (c) => {
  const queryAddress = c.req.query('address')
  const targetAddress = queryAddress || c.env.LGU_TREASURY_ADDRESS || process.env.LGU_TREASURY_ADDRESS

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

/**
 * POST /api/chain/transfer
 * Transfers PHPC tokens from the LGU treasury (server account) to a recipient.
 * Merchants may only transfer to their own registered wallet address.
 * Admins may transfer to any address.
 */
chainRoutes.post('/transfer', zValidator('json', transferSchema), async (c) => {
  const { to, amount } = c.req.valid('json')
  const user = c.get('user')

  // If merchant, verify they can only transfer to their own wallet
  if (user?.role === 'merchant') {
    const db = createServiceClient()
    const { data: merchant } = await (db as any)
      .from('merchants')
      .select('wallet_address')
      .eq('auth_user_id', user.id)
      .single()

    if (!merchant || merchant.wallet_address?.toLowerCase() !== to.toLowerCase()) {
      return c.json(
        { error: 'forbidden', message: 'Merchants may only transfer to their own registered wallet address' },
        403
      )
    }
  }

  try {
    const chainClient = new ChainClient()
    const amountWei = parseUnits(String(amount), 18)
    const txHash = await chainClient.transferPHPC(to, amountWei)
    const receipt = await chainClient.waitForTransactionReceipt(txHash)

    return c.json({
      success: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      to,
      amount,
    })
  } catch (err: any) {
    return c.json({ error: 'transfer_failed', message: err.message }, 500)
  }
})

export default chainRoutes
