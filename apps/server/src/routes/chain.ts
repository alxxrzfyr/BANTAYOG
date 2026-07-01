import { Hono } from 'hono'
import { createPublicClient, http, formatUnits, defineChain } from 'viem'
import type { Env } from '../types/env.js'

const chainRoutes = new Hono<{ Bindings: Env }>()

// Define Saigon testnet chain custom
const saigon = defineChain({
  id: 202601,
  name: 'Ronin Saigon Testnet',
  nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
  },
})

/**
 * GET /api/chain/balance
 * Queries the Ronin blockchain (via viem) for any address's (or LGU Treasury's) PHPC balance.
 *
 * Query params:
 *   - address?: Optional wallet address. Defaults to LGU_TREASURY_ADDRESS.
 */
chainRoutes.get('/balance', async (c) => {
  const queryAddress = c.req.query('address');
  const tokenAddress = c.env.PHPC_TOKEN_ADDRESS as `0x${string}`;
  const targetAddress = (queryAddress || c.env.LGU_TREASURY_ADDRESS) as `0x${string}`;

  if (!tokenAddress) {
    return c.json({ error: 'misconfigured', message: 'PHPC_TOKEN_ADDRESS is not set' }, 500);
  }

  if (!targetAddress) {
    return c.json({ error: 'bad_request', message: 'No target address provided and LGU_TREASURY_ADDRESS is not set' }, 400);
  }

  try {
    const rpcUrl = c.env.RONIN_SAIGON_RPC_URL || 'https://saigon-testnet.roninchain.com/rpc';
    const client = createPublicClient({
      chain: saigon,
      transport: http(rpcUrl),
    });

    const abi = [
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      }
    ] as const;

    const balanceWei = await client.readContract({
      address: tokenAddress,
      abi,
      functionName: 'balanceOf',
      args: [targetAddress],
    });

    const formatted = formatUnits(balanceWei, 18);

    return c.json({
      address: targetAddress,
      balance: balanceWei.toString(),
      formatted
    });
  } catch (err: any) {
    return c.json({ error: 'blockchain_query_failed', message: err.message }, 502);
  }
})

export default chainRoutes
