import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidEvmAddress } from './merchant-self.js'

// ---------------------------------------------------------------------------
// Unit tests for isValidEvmAddress helper
// ---------------------------------------------------------------------------

describe('isValidEvmAddress', () => {
  it('returns true for a valid 42-char 0x-prefixed hex address', () => {
    expect(isValidEvmAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')).toBe(true)
  })

  it('returns true for all-lowercase valid address', () => {
    expect(isValidEvmAddress('0x70997970c51812dc3a010c7d01b50e0d17dc79c8')).toBe(true)
  })

  it('returns true for all-uppercase valid address', () => {
    expect(isValidEvmAddress('0x70997970C51812DC3A010C7D01B50E0D17DC79C8')).toBe(true)
  })

  it('returns false for null', () => {
    expect(isValidEvmAddress(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isValidEvmAddress(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidEvmAddress('')).toBe(false)
  })

  it('returns false for address without 0x prefix', () => {
    expect(isValidEvmAddress('70997970C51812dc3A010C7d01b50e0d17dc79C8')).toBe(false)
  })

  it('returns false for address shorter than 42 chars', () => {
    expect(isValidEvmAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79')).toBe(false)
  })

  it('returns false for address longer than 42 chars', () => {
    expect(isValidEvmAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8FF')).toBe(false)
  })

  it('returns false for address with non-hex characters', () => {
    expect(isValidEvmAddress('0xGG997970C51812dc3A010C7d01b50e0d17dc79C8')).toBe(false)
  })
})

// Mock supabase before importing the app
const mockMerchantRow = {
  id: 'merchant-123',
  store_name: 'Aling Nena Sari-Sari',
  owner_name: 'Aling Nena',
  wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  wallet_balance: 1234.56,
  status: 'APPROVED',
  cashout_in_progress: false,
}

let testMerchantRow = { ...mockMerchantRow }
let dbUpdateError: any = null
let dbSelectError: any = null

const mockSupabaseClient = {
  from: vi.fn().mockImplementation((_table: string) => {
    const eqFilters: { col: string; val: any }[] = []
    let isUpdate = false
    let updateValues: any = null

    const runQuery = () => {
      if (dbSelectError && !isUpdate) {
        return { data: null, error: dbSelectError }
      }
      if (isUpdate) {
        if (dbUpdateError) {
          return { data: null, error: dbUpdateError }
        }
        const hasFalseLockFilter = eqFilters.some(f => f.col === 'cashout_in_progress' && f.val === false)
        if (hasFalseLockFilter && testMerchantRow.cashout_in_progress) {
          return { data: null, error: new Error('Lock collision') }
        }
        Object.assign(testMerchantRow, updateValues)
        return { data: testMerchantRow, error: null }
      }
      return { data: testMerchantRow, error: null }
    }

    const chain: any = {
      select: vi.fn().mockImplementation(() => chain),
      update: vi.fn().mockImplementation((values: any) => {
        isUpdate = true
        updateValues = values
        return chain
      }),
      eq: vi.fn().mockImplementation((col: string, val: any) => {
        eqFilters.push({ col, val })
        return chain
      }),
      single: vi.fn().mockImplementation(async () => {
        return runQuery()
      }),
      then: vi.fn().mockImplementation(async (onFulfilled: any) => {
        const res = runQuery()
        return Promise.resolve(res).then(onFulfilled)
      })
    }
    return chain
  }),
}

vi.mock('../lib/supabase.js', () => ({
  createServiceClient: () => mockSupabaseClient,
}))

// Mock auth to inject a user
let mockUser: { id: string; email: string; role: string } | null = null

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set('user', mockUser)
    await next()
  }),
}))

vi.mock('../middleware/rbac.js', () => ({
  requireRole: (..._roles: string[]) =>
    vi.fn().mockImplementation(async (c: any, next: any) => {
      const user = c.get('user')
      if (!user) {
        return c.json({ error: 'auth', message: 'Authentication required' }, 401)
      }
      if (!_roles.includes(user.role)) {
        return c.json({ error: 'auth', message: 'Forbidden', code: 'forbidden' }, 403)
      }
      await next()
    }),
}))

// Mock viem verifyMessage
vi.mock('viem', async (importOriginal) => {
  const original = await importOriginal<typeof import('viem')>()
  return {
    ...original,
    verifyMessage: vi.fn().mockImplementation(async ({ signature }) => {
      if (signature === '0xvalidsignature') return true
      return false
    })
  }
})

// Mock BlockchainClient
const mockBlockchainClient = {
  transferPHPC: vi.fn().mockResolvedValue({ isErr: () => false, isOk: () => true, value: '0xhash' }),
  waitForConfirmation: vi.fn().mockResolvedValue({ isErr: () => false, isOk: () => true, value: {} }),
}

vi.mock('../services/chain.client.js', () => ({
  BlockchainClient: {
    create: vi.fn().mockImplementation(() => Promise.resolve({
      isErr: () => false,
      isOk: () => true,
      value: mockBlockchainClient
    }))
  }
}))

vi.mock('../lib/chain/config.js', () => ({
  loadChainConfig: vi.fn().mockImplementation(() => ({
    isErr: () => false,
    isOk: () => true,
    value: {
      rpcUrl: 'https://amoy.example.com',
      phpcTokenAddress: '0xtoken',
      phpcSubsidyAddress: '0xsubsidy',
      lguAdminWallet: '0xadmin',
    }
  })),
  POLYGON_AMOY_CHAIN_ID: 80002
}))

// Import app after mocks are set up
const { app } = await import('../app.js')

describe('GET /api/merchants/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: 'auth-user-001', email: 'merchant@test.com', role: 'merchant' }
    testMerchantRow = { ...mockMerchantRow }
    dbSelectError = null
    dbUpdateError = null
  })

  it('returns 401 when unauthenticated', async () => {
    mockUser = null
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(401)
  })

  it('returns 403 when user role is not merchant', async () => {
    mockUser = { id: 'auth-admin-001', email: 'admin@test.com', role: 'admin' }
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(403)
  })

  it('returns 403 when merchant profile not found', async () => {
    dbSelectError = { message: 'Not found' }
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('not_found')
    expect(body.message).toBe('Merchant profile not found')
  })

  it('returns 200 with MerchantSelfDTO for authenticated merchant', async () => {
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.id).toBe('merchant-123')
    expect(body.storeName).toBe('Aling Nena Sari-Sari')
    expect(body.ownerName).toBe('Aling Nena')
    expect(body.walletAddress).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    expect(body.walletBalance).toBe(1234.56)
    expect(body.connected).toBe(true)
    expect(body.status).toBe('APPROVED')
  })

  it('returns connected: false when wallet_address is null', async () => {
    testMerchantRow.wallet_address = null
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.walletAddress).toBeNull()
    expect(body.connected).toBe(false)
  })

  it('returns connected: false when wallet_address is empty string', async () => {
    testMerchantRow.wallet_address = ''
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.walletAddress).toBe('')
    expect(body.connected).toBe(false)
  })

  it('returns walletBalance rounded to 2 decimal places', async () => {
    testMerchantRow.wallet_balance = 99.999
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.walletBalance).toBe(100)
  })

  it('returns walletBalance 0.00 when balance is zero', async () => {
    testMerchantRow.wallet_balance = 0
    const res = await app.request('/api/merchants/me')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.walletBalance).toBe(0)
  })
})

describe('POST /api/merchants/me/wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testMerchantRow = {
      id: 'merchant-123',
      store_name: 'Aling Nena Sari-Sari',
      owner_name: 'Aling Nena',
      wallet_address: null,
      wallet_balance: 1234.56,
      status: 'APPROVED',
      cashout_in_progress: false,
    }
    mockUser = { id: 'auth-user-001', email: 'merchant@test.com', role: 'merchant' }
    dbUpdateError = null
    dbSelectError = null
  })

  it('returns 400 for invalid EVM address format', async () => {
    const res = await app.request('/api/merchants/me/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: 'invalid-address',
        message: 'sign this message',
        signature: '0xvalidsignature',
      })
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for signature verification mismatch', async () => {
    const res = await app.request('/api/merchants/me/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        message: 'sign this message',
        signature: '0xinvalidsignature',
      })
    })
    expect(res.status).toBe(400)
  })

  it('persists verified address and returns updated DTO (Property 9 & 10)', async () => {
    const res = await app.request('/api/merchants/me/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        message: 'sign this message',
        signature: '0xvalidsignature',
      })
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.walletAddress).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    expect(body.connected).toBe(true)
    expect(testMerchantRow.wallet_address).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
  })
})

describe('POST /api/merchants/me/cashout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testMerchantRow = {
      id: 'merchant-123',
      store_name: 'Aling Nena Sari-Sari',
      owner_name: 'Aling Nena',
      wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      wallet_balance: 100.50,
      status: 'APPROVED',
      cashout_in_progress: false,
    }
    mockUser = { id: 'auth-user-001', email: 'merchant@test.com', role: 'merchant' }
    dbUpdateError = null
    dbSelectError = null
    mockBlockchainClient.transferPHPC.mockResolvedValue({ isErr: () => false, isOk: () => true, value: '0xhash' })
    mockBlockchainClient.waitForConfirmation.mockResolvedValue({ isErr: () => false, isOk: () => true, value: {} })
  })

  it('settles snapshot to persisted wallet and zeroes balance on success (Property 4)', async () => {
    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.txHash).toBe('0xhash')
    expect(body.walletBalance).toBe(0)
    expect(testMerchantRow.wallet_balance).toBe(0)
    expect(testMerchantRow.cashout_in_progress).toBe(false)
  })

  it('leaves balance unchanged and releases lock on transfer failure (Property 5)', async () => {
    mockBlockchainClient.transferPHPC.mockResolvedValue({
      isErr: () => true,
      isOk: () => false,
      error: new Error('simulated onchain failure')
    })

    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
    })
    expect(res.status).toBe(502)
    expect(testMerchantRow.wallet_balance).toBe(100.50)
    expect(testMerchantRow.cashout_in_progress).toBe(false)
  })

  it('leaves balance unchanged and releases lock on confirmation timeout (Property 5)', async () => {
    mockBlockchainClient.waitForConfirmation.mockResolvedValue({
      isErr: () => true,
      isOk: () => false,
      error: new Error('timeout waiting for receipt')
    })

    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
    })
    expect(res.status).toBe(502)
    expect(testMerchantRow.wallet_balance).toBe(100.50)
    expect(testMerchantRow.cashout_in_progress).toBe(false)
  })

  it('rejects cashout if wallet_address is null (Property 6)', async () => {
    testMerchantRow.wallet_address = null

    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toBe('wallet required')
  })

  it('rejects cashout if balance is zero (Property 6)', async () => {
    testMerchantRow.wallet_balance = 0

    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toBe('no balance to transfer')
  })

  it('rejects cashout if client body specifies a different destination address (Property 7)', async () => {
    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: '0x1234567890123456789012345678901234567890'
      })
    })
    expect(res.status).toBe(400)
    expect(testMerchantRow.wallet_balance).toBe(100.50)
  })

  it('accepts cashout if client body specifies matching destination address (Property 7)', async () => {
    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
      })
    })
    expect(res.status).toBe(200)
    expect(testMerchantRow.wallet_balance).toBe(0)
  })

  it('rejects concurrent cashout if cashout_in_progress is already true (Property 8)', async () => {
    testMerchantRow.cashout_in_progress = true

    const res = await app.request('/api/merchants/me/cashout', {
      method: 'POST',
    })
    expect(res.status).toBe(409)
    expect(testMerchantRow.wallet_balance).toBe(100.50)
    expect(testMerchantRow.cashout_in_progress).toBe(true)
  })
})
