import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { CreateBeneficiaryDto } from '@bantayog/schema'
import { createServiceClient } from '../lib/supabase.js'
import { BeneficiaryService } from '../services/beneficiary.service.js'
import { createPublicClient, http, formatUnits, defineChain } from 'viem'
import type { Env } from '../types/env.js'

const beneficiaryRoutes = new Hono<{ Bindings: Env }>()

// Define Saigon testnet chain custom to avoid dependency issues
const saigon = defineChain({
  id: 202601,
  name: 'Ronin Saigon Testnet',
  nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
  },
})

// Validation Schema for Credits top-up
const addCreditsSchema = z.object({
  amount: z.number().positive()
})

/**
 * Helper to fetch LGU balance from the blockchain.
 */
async function getLguBalance(env: Env): Promise<bigint> {
  const rpcUrl = env.RONIN_SAIGON_RPC_URL || 'https://saigon-testnet.roninchain.com/rpc';
  const tokenAddress = env.PHPC_TOKEN_ADDRESS as `0x${string}`;
  const treasuryAddress = env.LGU_TREASURY_ADDRESS as `0x${string}`;

  if (!tokenAddress || !treasuryAddress) {
    throw new Error('PHPC_TOKEN_ADDRESS or LGU_TREASURY_ADDRESS is not set');
  }

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

  return client.readContract({
    address: tokenAddress,
    abi,
    functionName: 'balanceOf',
    args: [treasuryAddress],
  });
}

/**
 * POST /api/beneficiaries/register
 * Onboard a new beneficiary and generate QR Voucher/Pass
 */
beneficiaryRoutes.post('/register', zValidator('json', CreateBeneficiaryDto), async (c) => {
  const dto = c.req.valid('json')
  const db = createServiceClient()
  const service = new BeneficiaryService(db)

  try {
    const result = await service.register({
      guardianName: dto.guardianName,
      guardianMobileHash: dto.guardianMobileHash,
      childName: dto.childName,
      childAgeMonths: dto.childAgeMonths,
      monthlyIncomePhp: dto.monthlyIncomePhp,
      gpsLat: dto.gpsLat,
      gpsLng: dto.gpsLng,
      pin: dto.pin
    });

    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: 'registration_failed', message: err.message }, 500)
  }
})

/**
 * GET /api/beneficiaries
 * Fetch paginated active beneficiaries directory
 */
beneficiaryRoutes.get('/', async (c) => {
  const db = createServiceClient()
  const service = new BeneficiaryService(db)

  const page = Number(c.req.query('page') || '1')
  const limit = Number(c.req.query('limit') || '20')

  try {
    const result = await service.list(page, limit)
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: 'list_failed', message: err.message }, 500)
  }
})

/**
 * PATCH /api/beneficiaries/:id/credits
 * Top-up credits with LGU balance pre-flight check
 */
beneficiaryRoutes.patch('/:id/credits', zValidator('json', addCreditsSchema), async (c) => {
  const id = c.req.param('id')
  const { amount } = c.req.valid('json')
  const db = createServiceClient()
  const service = new BeneficiaryService(db)

  try {
    // 1. Fetch LGU balance from blockchain
    const lguBalanceWei = await getLguBalance(c.env);
    const lguBalance = Number(formatUnits(lguBalanceWei, 18));

    // 2. Validate sufficient LGU balance
    if (lguBalance < amount) {
      return c.json({
        error: 'insufficient_funds',
        message: `Insufficient LGU treasury balance. Required: ${amount} PHPC, Available: ${lguBalance} PHPC`
      }, 422)
    }

    // 3. Add credits
    const result = await service.addCredits(id, amount)
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: 'topup_failed', message: err.message }, 500)
  }
})

export default beneficiaryRoutes
