import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Keypair } from '@stellar/stellar-sdk'
import fc from 'fast-check'
import { ok, err } from 'neverthrow'
import { BeneficiaryService } from './beneficiary.service.js'
import { QrTokenService } from './qr-token.service.js'
import { StellarClient } from './chain.client.js'
import { OnchainError } from '../lib/errors.js'

const testIssuer = Keypair.random()

// Controllable StellarClient.create result, set per test/property run
// below. `BeneficiaryService.register` now ALSO calls `StellarClient.create`
// to provision the generated wallet on-chain (non-blocking on failure), so
// every describe block below must provide a resolved value — default to a
// successful create with a no-op `provisionAccount` unless a specific test
// overrides it to exercise a provisioning failure.
vi.mock('./chain.client.js', () => ({
  StellarClient: {
    create: vi.fn(),
  },
}))

// Unit tests for BeneficiaryService.register's custodial-wallet wiring.
// Validates: Requirements 5.5 — a successful registration persists exactly
// one `beneficiary_wallets` row and the QR token payload's `walletRef`
// matches the stored wallet address.

// ── Minimal stateful mock DB (self-contained; not imported from e2e tests) ──
// LIMITATION: This in-memory stateful Supabase fake simulates RPC outcomes
// (acquired, busy, issued, insufficient) and table mutations for unit testing
// the service orchestration layer. It is not real concurrent SQL proof (no actual
// PostgreSQL transaction isolation, row locking, or multi-connection concurrency);
// real concurrency is checked separately in native PostgreSQL. PGlite checks SQL behavior.
let mockDbState: Record<string, any[]> = {
  beneficiaries: [],
  beneficiary_wallets: [],
  qr_passes: [],
  allocations: [],
  fund_topups: [],
  fund_grant_reservations: [],
}

function resetMockDbState() {
  mockDbState = {
    beneficiaries: [],
    beneficiary_wallets: [],
    qr_passes: [],
    allocations: [],
    fund_topups: [],
    fund_grant_reservations: [],
  }
}

function createSelectBuilder(_table: string, data: any[]) {
  let filtered = [...data]
  const count = data.length

  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation((col: string, val: any) => {
      filtered = filtered.filter((r) => r[col] === val)
      return chain
    }),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation((n: number) => {
      filtered = filtered.slice(0, n)
      return chain
    }),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: filtered[0] || null,
        error: filtered.length === 0 ? new Error('Not found') : null,
      }),
    ),
    maybeSingle: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: filtered[0] || null,
        error: null,
      }),
    ),
    then: (onFulfilled: any) =>
      Promise.resolve({ data: filtered, count, error: null }).then(onFulfilled),
  }
  return chain
}

const mockSupabaseClient: any = {
  from: vi.fn().mockImplementation((table: string) => {
    const tableData = mockDbState[table] || []

    return {
      select: vi.fn().mockImplementation(() => createSelectBuilder(table, tableData)),
      insert: vi.fn().mockImplementation((data: any) => {
        const rows = Array.isArray(data) ? data : [data]
        const inserted = rows.map((row) => ({
          id: row.id || `gen-${Math.random().toString(36).substring(2, 10)}`,
          ...row,
          created_at: row.created_at || new Date().toISOString(),
        }))
        mockDbState[table]?.push(...inserted)
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: inserted[0], error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: inserted[0], error: null }),
          then: (onFulfilled: any) =>
            Promise.resolve({ data: inserted, error: null }).then(onFulfilled),
        }
      }),
      // Minimal `.delete().eq(...)` support so `BaseRepository.deleteById`
      // (used by the compensating rollback in `BeneficiaryService.register`)
      // works against this mock. `await x.delete().eq(col, val)` never
      // awaits a further `.select()`/`.single()`, so `.eq()` can just return
      // a plain `{ error, count }` value directly (a non-promise resolves
      // immediately under `await`).
      delete: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          const rows = mockDbState[table] || []
          const before = rows.length
          mockDbState[table] = rows.filter((r) => r[col] !== val)
          const count = before - (mockDbState[table]?.length ?? 0)
          return { error: null, count }
        }),
      })),
      // Minimal `.update(values).eq('id', id).select('*').single()` support
      // so `BaseRepository.updateById` (used by `allocateTierCredits`'s
      // balance update and `reconcileAllocation`'s `reconciled` flag update,
      // Tasks 10.3–10.5) mutates `mockDbState[table]` in place.
      update: vi.fn().mockImplementation((values: any) => ({
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          const rows = mockDbState[table] || []
          const idx = rows.findIndex((r) => r[col] === val)
          if (idx !== -1) {
            rows[idx] = { ...rows[idx], ...values }
          }
          const updated = idx !== -1 ? rows[idx] : null
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updated,
                error: updated ? null : new Error('Not found'),
              }),
            }),
            single: vi.fn().mockResolvedValue({
              data: updated,
              error: updated ? null : new Error('Not found'),
            }),
          }
        }),
      })),
      eq: vi
        .fn()
        .mockImplementation((col: string, val: any) => createSelectBuilder(table, tableData).eq(col, val)),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  }),
  rpc: vi.fn().mockImplementation((fn: string, params: any) => {
    if (fn === 'reserve_grant_funding') {
      const { p_beneficiary_id, p_attempt_id, p_amount_php } = params || {}
      if (!p_beneficiary_id || !p_attempt_id || !['5000.00', '3500.00'].includes(p_amount_php)) {
        return Promise.resolve({ data: null, error: new Error('Invalid grant reservation parameters') })
      }
      const hasAllocation = (mockDbState.allocations || []).some((a) => a.beneficiary_id === p_beneficiary_id)
      const hasIssuedReservation = (mockDbState.fund_grant_reservations || []).some(
        (r) => r.beneficiary_id === p_beneficiary_id && r.status === 'ISSUED',
      )
      if (hasAllocation || hasIssuedReservation) {
        return Promise.resolve({ data: { outcome: 'issued' }, error: null })
      }
      const hasReserved = (mockDbState.fund_grant_reservations || []).some(
        (r) => r.beneficiary_id === p_beneficiary_id && r.status === 'RESERVED',
      )
      if (hasReserved) {
        return Promise.resolve({ data: { outcome: 'busy' }, error: null })
      }
      const completedTopupsNet = (mockDbState.fund_topups || [])
        .filter((t) => t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.net_amount_php || 0), 0)
      const reservedTotal = (mockDbState.fund_grant_reservations || [])
        .reduce((sum, r) => sum + Number(r.amount_php || 0), 0)
      const available = completedTopupsNet - reservedTotal
      const requested = Number(p_amount_php)
      if (available < requested) {
        return Promise.resolve({
          data: { outcome: 'insufficient', availablePhp: available.toFixed(2) },
          error: null,
        })
      }
      mockDbState.fund_grant_reservations.push({
        beneficiary_id: p_beneficiary_id,
        attempt_id: p_attempt_id,
        amount_php: p_amount_php,
        status: 'RESERVED',
        created_at: new Date().toISOString(),
      })
      return Promise.resolve({ data: { outcome: 'acquired' }, error: null })
    }
    if (fn === 'mark_grant_funded') {
      const { p_beneficiary_id, p_attempt_id } = params || {}
      const reservation = (mockDbState.fund_grant_reservations || []).find(
        (r) => r.beneficiary_id === p_beneficiary_id && r.attempt_id === p_attempt_id,
      )
      if (!reservation) {
        return Promise.resolve({ data: false, error: null })
      }
      const matchingAllocation = (mockDbState.allocations || []).find(
        (a) =>
          a.beneficiary_id === p_beneficiary_id &&
          Number(a.amount_phpc) === Number(reservation.amount_php) &&
          Boolean(a.onchain_tx_hash),
      )
      if (!matchingAllocation) {
        return Promise.resolve({ data: false, error: null })
      }
      reservation.status = 'ISSUED'
      return Promise.resolve({ data: true, error: null })
    }
    return Promise.resolve({ data: null, error: new Error(`Unknown RPC ${fn}`) })
  }),
}

describe('BeneficiaryService.register — custodial wallet wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbState()

    vi.stubEnv('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org')
    vi.stubEnv('STELLAR_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015')
    vi.stubEnv('PHPC_ASSET_CODE', 'PHPC')
    vi.stubEnv('PHPC_ISSUER_PUBLIC_KEY', testIssuer.publicKey())
    vi.stubEnv('PHPC_ISSUER_SECRET', testIssuer.secret())
    vi.stubEnv('PHPC_DISTRIBUTION_SECRET', Keypair.random().secret())
    vi.stubEnv('STELLAR_SPONSOR_SECRET', Keypair.random().secret())
    vi.stubEnv('CUSTODIAL_KEY_ENCRYPTION_KEY', 'test-key-encryption-key')
    vi.stubEnv('QR_TOKEN_SECRET', 'test-qr-token-secret')

    // Default: StellarClient constructs successfully and provisioning
    // succeeds, so these tests exercise the DB-persistence assertions
    // without depending on Horizon connectivity.
    ;(StellarClient.create as any).mockResolvedValue(
      ok({
        provisionAccount: vi.fn().mockResolvedValue(ok(undefined)),
      }),
    )
  })

  it('persists exactly one beneficiary_wallets row and embeds a matching walletRef in the QR token on successful registration', async () => {
    const service = new BeneficiaryService(mockSupabaseClient)

    const result = await service.register({
      guardianName: 'Maria Dela Cruz',
      guardianMobileHash: 'sha256-mobile-hash-1',
      childName: 'Juan Dela Cruz',
      childAgeMonths: 6,
      monthlyIncomePhp: 5000,
      gpsLat: 14.6,
      gpsLng: 121.0,
      pin: '123456',
    })

    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    // Exactly one beneficiary_wallets row was persisted.
    expect(mockDbState.beneficiary_wallets.length).toBe(1)
    const storedAddress = mockDbState.beneficiary_wallets[0].address

    // Decode the QR token and confirm walletRef matches the stored address.
    const qrTokenService = new QrTokenService()
    const verifyResult = await qrTokenService.verifyToken(result.value.qrToken)
    expect(verifyResult.isOk()).toBe(true)
    if (verifyResult.isOk()) {
      expect(verifyResult.value.walletRef).toBe(storedAddress)
    }
  })

  it('returns ok(...) with beneficiary, tier, qrToken, and cardSerial populated', async () => {
    const service = new BeneficiaryService(mockSupabaseClient)

    const result = await service.register({
      guardianName: 'Ana Santos',
      guardianMobileHash: 'sha256-mobile-hash-2',
      childName: 'Pedro Santos',
      childAgeMonths: 8,
      monthlyIncomePhp: 6000,
      gpsLat: 14.55,
      gpsLng: 121.02,
      pin: '654321',
    })

    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    expect(result.value.beneficiary).toBeDefined()
    expect(result.value.beneficiary.child_name).toBe('Pedro Santos')
    expect(typeof result.value.tier).toBe('number')
    expect(result.value.qrToken.length).toBeGreaterThan(20)
    expect(result.value.cardSerial).toMatch(/^BTY-/)
  })
})

// Property 15: Registration wallet failure persists no partial state.
// Validates: Requirements 5.6
// Feature: polygon-amoy-phpc-migration, Property 15: when custodial wallet
// generation fails during registration, no beneficiary record and no
// partial beneficiary_wallets row are left persisted (the compensating
// delete removes the just-inserted beneficiary row).
describe('Property 15: registration wallet failure persists no partial state', () => {
  const originalFrom = mockSupabaseClient.from

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbState()

    vi.stubEnv('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org')
    vi.stubEnv('STELLAR_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015')
    vi.stubEnv('PHPC_ASSET_CODE', 'PHPC')
    vi.stubEnv('PHPC_ISSUER_PUBLIC_KEY', testIssuer.publicKey())
    vi.stubEnv('PHPC_ISSUER_SECRET', testIssuer.secret())
    vi.stubEnv('PHPC_DISTRIBUTION_SECRET', Keypair.random().secret())
    vi.stubEnv('STELLAR_SPONSOR_SECRET', Keypair.random().secret())
    vi.stubEnv('CUSTODIAL_KEY_ENCRYPTION_KEY', 'test-key-encryption-key')
    vi.stubEnv('QR_TOKEN_SECRET', 'test-qr-token-secret')

    // Force the `beneficiary_wallets` insert (what
    // `CustodialWalletService.generateWallet`'s `this.repo.insert(...)`
    // ultimately calls via `BaseRepository.insert`'s
    // `.insert(values).select('*').single()` chain) to resolve an error,
    // simulating a wallet-generation persistence failure. The `beneficiaries`
    // table insert is left untouched so the beneficiary row gets created
    // first, exactly matching the real failure scenario the compensating
    // delete in `BeneficiaryService.register` handles.
    mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
      const builder = originalFrom(table)
      if (table === 'beneficiary_wallets') {
        builder.insert = vi.fn().mockImplementation(() => {
          const error = new Error('simulated wallet insert failure')
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error }),
            }),
            single: vi.fn().mockResolvedValue({ data: null, error }),
            then: (onFulfilled: any) =>
              Promise.resolve({ data: null, error }).then(onFulfilled),
          }
        })
      }
      return builder
    })
  })

  afterEach(() => {
    mockSupabaseClient.from = originalFrom
    vi.unstubAllEnvs()
  })

  it('when wallet generation fails, no beneficiary record and no partial wallet data are persisted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          guardianName: fc.string({ minLength: 1, maxLength: 50 }),
          childName: fc.string({ minLength: 1, maxLength: 50 }),
          childAgeMonths: fc.integer({ min: 0, max: 60 }),
        }),
        async (dto) => {
          resetMockDbState()

          const service = new BeneficiaryService(mockSupabaseClient)
          const result = await service.register({
            guardianName: dto.guardianName,
            guardianMobileHash: 'hash-' + dto.guardianName,
            childName: dto.childName,
            childAgeMonths: dto.childAgeMonths,
            monthlyIncomePhp: 5000,
            gpsLat: 14.6,
            gpsLng: 121.0,
            pin: '123456',
          })

          // Registration must report failure — the wallet-generation error.
          expect(result.isErr()).toBe(true)
          // No beneficiary record persisted (compensating delete ran).
          expect(mockDbState.beneficiaries.length).toBe(0)
          // No partial wallet data persisted either.
          expect(mockDbState.beneficiary_wallets.length).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  }, 120000)
})

// Shared env stubbing for the allocation/reconciliation property tests below
// (Tasks 10.3–10.5). These mirror the exact Polygon Amoy env vars stubbed
// for the Property 15 suite above, since `allocateTierCredits`/
// `reconcileAllocation` both call `loadChainConfig(process.env)`.

function stubAllocationEnv() {
  vi.stubEnv('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org')
  vi.stubEnv('STELLAR_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015')
  vi.stubEnv('PHPC_ASSET_CODE', 'PHPC')
  vi.stubEnv('PHPC_ISSUER_PUBLIC_KEY', testIssuer.publicKey())
  vi.stubEnv('PHPC_ISSUER_SECRET', testIssuer.secret())
  vi.stubEnv('PHPC_DISTRIBUTION_SECRET', Keypair.random().secret())
  vi.stubEnv('STELLAR_SPONSOR_SECRET', Keypair.random().secret())
  vi.stubEnv('CUSTODIAL_KEY_ENCRYPTION_KEY', 'test-key-encryption-key')
  vi.stubEnv('QR_TOKEN_SECRET', 'test-qr-token-secret')
}

// Property 6: Tier allocation credits the correct amount and conserves
// total supply.
// Validates: Requirements 4.1, 4.2, 4.3, 4.5
// Feature: polygon-amoy-phpc-migration, Property 6: for either tier, a
// successful allocation increases the beneficiary's recorded balance by
// exactly the tier amount (5000 for Tier 1, 3500 for Tier 2) and persists
// exactly one `allocations` row recording that same tier/amount — the
// allocation's Transaction_Record per the design's data model.
describe('Property 6: tier allocation credits the correct amount and conserves total supply (Requirements 4.1, 4.2, 4.3, 4.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbState()
    stubAllocationEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('increases the beneficiary balance by exactly the tier amount and records a matching allocation row', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(1, 2), fc.uuid(), async (tier, beneficiaryId) => {
        resetMockDbState()
        mockDbState.fund_topups.push({ id: 'topup-p6', status: 'COMPLETED', net_amount_php: '100000.00' })

        const tierAmount = tier === 1 ? 5000 : 3500

        ;(StellarClient.create as any).mockResolvedValue(
          ok({
            hasAuthorizedTrustline: vi.fn().mockResolvedValue(ok(true)),
            allocateSubsidy: vi.fn().mockResolvedValue(ok({ hash: 'stellarhash123', ledger: 42 })),
          }),
        )

        // Fixture chosen well within each tier's range (per
        // `domain/eligibility.ts`'s conception-day arithmetic) to avoid
        // boundary flakiness: a newborn (childAgeMonths=0, just registered)
        // is always Tier 1; a 40-month-old is always Tier 2.
        const beneficiary = {
          id: beneficiaryId,
          credit_balance: 0,
          created_at: new Date().toISOString(),
          child_age_months: tier === 1 ? 0 : 40,
        }
        mockDbState.beneficiaries.push(beneficiary)

        // Provide a provisioned wallet for the trustline check
        mockDbState.beneficiary_wallets.push({
          beneficiary_id: beneficiaryId,
          address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2',
        })

        const service = new BeneficiaryService(mockSupabaseClient)
        const result = await service.allocateTierCredits(beneficiaryId)

        expect(result.isOk()).toBe(true)
        if (result.isOk()) {
          expect(result.value.amount).toBe(tierAmount)
        }

        const updated = mockDbState.beneficiaries.find((b: any) => b.id === beneficiaryId)
        expect(Number(updated.credit_balance)).toBe(tierAmount)

        // Exactly one allocation row was recorded with the correct
        // tier/amount — this is the allocation's Transaction_Record.
        expect(mockDbState.allocations.length).toBe(1)
        expect(mockDbState.allocations[0].tier).toBe(tier)
        expect(mockDbState.allocations[0].amount_phpc).toBe(tierAmount)
        // F7: the ledger sequence returned by allocateSubsidy is actually
        // persisted alongside the transaction hash, not silently discarded.
        expect(mockDbState.allocations[0].ledger_sequence).toBe(42)
        expect(mockDbState.allocations[0].onchain_tx_hash).toBe('stellarhash123')
      }),
      { numRuns: 20 },
    )
  })
})

// Property 7: Rejected allocations leave balances unchanged.
// Validates: Requirements 4.4, 4.7, 4.8, 4.9
// Feature: polygon-amoy-phpc-migration, Property 7: for each reachable
// rejection cause (insufficient treasury, duplicate allocation, on-chain
// failure), the beneficiary's recorded balance stays at 0 and no new
// `allocations` row is inserted. Requirement 4.9's invalid-tier rejection
// path is not exercised here since `computeTier` only ever returns 1 | 2 by
// its type signature — that branch is a defensive/unreachable guard, as
// noted in `allocateTierCredits`'s own code comment.
describe('Property 7: rejected allocations leave balances unchanged (Requirements 4.4, 4.7, 4.8, 4.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbState()
    stubAllocationEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('leaves the beneficiary balance at 0 and inserts no new allocation row when rejected for missing trustline, duplicate allocation, or on-chain failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('missing_trustline', 'duplicate_allocation', 'onchain_failure'),
        fc.uuid(),
        async (rejectionCause, beneficiaryId) => {
          resetMockDbState()
          mockDbState.fund_topups.push({ id: 'topup-p7', status: 'COMPLETED', net_amount_php: '100000.00' })

          const beneficiary = {
            id: beneficiaryId,
            credit_balance: 0,
            created_at: new Date().toISOString(),
            child_age_months: 0,
          }
          mockDbState.beneficiaries.push(beneficiary)

          // Provide a wallet row so the wallet lookup succeeds
          mockDbState.beneficiary_wallets.push({
            beneficiary_id: beneficiaryId,
            address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2',
          })

          if (rejectionCause === 'duplicate_allocation') {
            mockDbState.allocations.push({
              id: 'existing-alloc',
              beneficiary_id: beneficiaryId,
              tier: 1,
              amount_phpc: 5000,
              onchain_tx_hash: 'stellarhash',
              reconciled: false,
              allocated_at: new Date().toISOString(),
            })
          }

          ;(StellarClient.create as any).mockResolvedValue(
            ok({
              hasAuthorizedTrustline: vi.fn().mockResolvedValue(
                rejectionCause === 'missing_trustline' ? ok(false) : ok(true),
              ),
              allocateSubsidy: vi
                .fn()
                .mockResolvedValue(
                  rejectionCause === 'onchain_failure'
                    ? err(new OnchainError('simulated failure', 0))
                    : ok({ hash: 'stellarhash', ledger: 42 }),
                ),
            }),
          )

          const service = new BeneficiaryService(mockSupabaseClient)
          const result = await service.allocateTierCredits(beneficiaryId)

          expect(result.isErr()).toBe(true)
          const unchanged = mockDbState.beneficiaries.find((b: any) => b.id === beneficiaryId)
          expect(Number(unchanged.credit_balance)).toBe(0)

          if (rejectionCause !== 'duplicate_allocation') {
            expect(mockDbState.allocations.length).toBe(0)
          } else {
            // The pre-existing allocation row is left unchanged; no new one added.
            expect(mockDbState.allocations.length).toBe(1)
          }
        },
      ),
      { numRuns: 20 },
    )
  })
})

// Property 8: Reconciliation mismatch flags the allocation.
// Validates: Requirement 4.6
// Feature: polygon-amoy-phpc-migration, Property 8: when the beneficiary's
// recorded `credit_balance` diverges from the recorded allocation's
// `amount_phpc`, `reconcileAllocation` returns an identifying error and
// leaves (or sets) the allocation's `reconciled` flag to `false`.
describe('Property 8: reconciliation mismatch flags the allocation (Requirement 4.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbState()
    stubAllocationEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('flags reconciled=false and returns an identifying error when the recorded balance diverges from the allocation amount', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 5001, max: 10000 }),
        async (beneficiaryId, recordedBalance, allocationAmount) => {
          resetMockDbState()

          mockDbState.beneficiaries.push({
            id: beneficiaryId,
            credit_balance: recordedBalance,
            created_at: new Date().toISOString(),
            child_age_months: 0,
          })
          mockDbState.allocations.push({
            id: 'alloc-1',
            beneficiary_id: beneficiaryId,
            tier: 1,
            amount_phpc: allocationAmount,
            onchain_tx_hash: '0xtxhash',
            reconciled: false,
            allocated_at: new Date().toISOString(),
          })

          ;(StellarClient.create as any).mockResolvedValue(
            ok({
              // On-chain re-confirmation succeeds; the mismatch under test
              // is purely the recorded-balance-vs-amount divergence.
              waitForConfirmation: vi.fn().mockResolvedValue(ok({})),
            }),
          )

          const service = new BeneficiaryService(mockSupabaseClient)
          const result = await service.reconcileAllocation(beneficiaryId)

          expect(result.isErr()).toBe(true)
          const alloc = mockDbState.allocations.find((a: any) => a.id === 'alloc-1')
          expect(alloc.reconciled).toBe(false)
        },
      ),
      { numRuns: 20 },
    )
  })
})

describe('Funded grant boundary (CONTRACT.md)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDbState()
    stubAllocationEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects an allocation when the funding pool is empty before chain or config', async () => {
    const beneficiaryId = '00000000-0000-4000-8000-000000000001'
    mockDbState.beneficiaries.push({
      id: beneficiaryId,
      credit_balance: 0,
      created_at: new Date().toISOString(),
      child_age_months: 0, // Tier 1 (5000.00 PHP)
    })
    mockDbState.beneficiary_wallets.push({
      beneficiary_id: beneficiaryId,
      address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2',
    })

    const allocateSubsidySpy = vi.fn().mockResolvedValue(ok({ hash: 'tx123', ledger: 100 }))
    ;(StellarClient.create as any).mockResolvedValue(
      ok({
        hasAuthorizedTrustline: vi.fn().mockResolvedValue(ok(true)),
        allocateSubsidy: allocateSubsidySpy,
      }),
    )

    const service = new BeneficiaryService(mockSupabaseClient)
    const result = await service.allocateTierCredits(beneficiaryId)

    // Pool is empty (0.00 PHP available), so reservation must fail and return ValidationError
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('validation')
      expect(result.error.message).toMatch(/Insufficient grant funding.*needed 5000\.00 PHP.*available 0\.00 PHP/i)
    }
    // External chain subsidy must NOT have been called
    expect(allocateSubsidySpy).not.toHaveBeenCalled()
    // No allocation row persisted
    expect(mockDbState.allocations.length).toBe(0)
    // Beneficiary balance unchanged
    expect(Number(mockDbState.beneficiaries[0].credit_balance)).toBe(0)
  })

  it('exact net passes and debits pool to zero for next attempt', async () => {
    // 5000.00 exact net contributed
    mockDbState.fund_topups.push({
      id: 'topup-exact',
      status: 'COMPLETED',
      net_amount_php: '5000.00',
    })

    const b1 = '00000000-0000-4000-8000-000000000001'
    const b2 = '00000000-0000-4000-8000-000000000002'

    mockDbState.beneficiaries.push(
      { id: b1, credit_balance: 0, created_at: new Date().toISOString(), child_age_months: 0 }, // Tier 1 (5000.00)
      { id: b2, credit_balance: 0, created_at: new Date().toISOString(), child_age_months: 40 }, // Tier 2 (3500.00)
    )
    mockDbState.beneficiary_wallets.push(
      { beneficiary_id: b1, address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2' },
      { beneficiary_id: b2, address: 'GCZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW3' },
    )

    let subsidyCallCount = 0
    ;(StellarClient.create as any).mockResolvedValue(
      ok({
        hasAuthorizedTrustline: vi.fn().mockResolvedValue(ok(true)),
        allocateSubsidy: vi.fn().mockImplementation((_id, _acc, tier) => {
          subsidyCallCount++
          return Promise.resolve(ok({ hash: `hash-${tier}`, ledger: 101 }))
        }),
      }),
    )

    const service = new BeneficiaryService(mockSupabaseClient)

    // First allocation consumes the exact 5000.00 PHP available
    const res1 = await service.allocateTierCredits(b1)
    expect(res1.isOk()).toBe(true)
    const updatedB1 = mockDbState.beneficiaries.find((b) => b.id === b1)
    expect(Number(updatedB1.credit_balance)).toBe(5000)
    expect(mockDbState.allocations.filter((a) => a.beneficiary_id === b1).length).toBe(1)
    const reservationB1 = mockDbState.fund_grant_reservations.find((r) => r.beneficiary_id === b1)
    expect(reservationB1?.status).toBe('ISSUED')
    expect(reservationB1?.amount_php).toBe('5000.00')

    // Second allocation attempts 3500.00 PHP, but available is now 0.00 PHP
    const res2 = await service.allocateTierCredits(b2)
    expect(res2.isErr()).toBe(true)
    if (res2.isErr()) {
      expect(res2.error.message).toMatch(/Insufficient grant funding.*needed 3500\.00 PHP.*available 0\.00 PHP/i)
    }
    const updatedB2 = mockDbState.beneficiaries.find((b) => b.id === b2)
    expect(Number(updatedB2.credit_balance)).toBe(0)
    expect(mockDbState.allocations.filter((a) => a.beneficiary_id === b2).length).toBe(0)
    // No second on-chain subsidy was submitted
    expect(subsidyCallCount).toBe(1)
  })

  it('repeated or simultaneous same beneficiary sends only once and rejects repeat', async () => {
    mockDbState.fund_topups.push({ id: 'topup-1', status: 'COMPLETED', net_amount_php: '20000.00' })
    const beneficiaryId = '00000000-0000-4000-8000-000000000001'
    mockDbState.beneficiaries.push({
      id: beneficiaryId,
      credit_balance: 0,
      created_at: new Date().toISOString(),
      child_age_months: 0,
    })
    mockDbState.beneficiary_wallets.push({
      beneficiary_id: beneficiaryId,
      address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2',
    })

    let subsidyCalls = 0
    ;(StellarClient.create as any).mockResolvedValue(
      ok({
        hasAuthorizedTrustline: vi.fn().mockResolvedValue(ok(true)),
        allocateSubsidy: vi.fn().mockImplementation(() => {
          subsidyCalls++
          return Promise.resolve(ok({ hash: 'tx-repeat', ledger: 102 }))
        }),
      }),
    )

    const service = new BeneficiaryService(mockSupabaseClient)

    const results = await Promise.all([
      service.allocateTierCredits(beneficiaryId),
      service.allocateTierCredits(beneficiaryId),
    ])
    expect(results.filter(result => result.isOk())).toHaveLength(1)
    expect(results.filter(result => result.isErr())).toHaveLength(1)
    expect(subsidyCalls).toBe(1)
    expect(mockDbState.allocations.length).toBe(1)
    expect(Number(mockDbState.beneficiaries[0].credit_balance)).toBe(5000)

    // Second call rejects duplicate (either duplicate check or issued reservation outcome)
    const secondResult = await service.allocateTierCredits(beneficiaryId)
    expect(secondResult.isErr()).toBe(true)
    if (secondResult.isErr()) {
      expect(secondResult.error._tag).toBe('validation')
      expect(secondResult.error.message).toMatch(/already has a prior allocation/i)
    }
    // Observable invariant: no second chain submission occurred
    expect(subsidyCalls).toBe(1)
    expect(mockDbState.allocations.length).toBe(1)
    expect(Number(mockDbState.beneficiaries[0].credit_balance)).toBe(5000)
  })

  it('busy or issued outcome never submits on-chain', async () => {
    mockDbState.fund_topups.push({ id: 't-pool', status: 'COMPLETED', net_amount_php: '10000.00' })
    const beneficiaryId = '00000000-0000-4000-8000-000000000001'
    mockDbState.beneficiaries.push({
      id: beneficiaryId,
      credit_balance: 0,
      created_at: new Date().toISOString(),
      child_age_months: 0,
    })
    mockDbState.beneficiary_wallets.push({
      beneficiary_id: beneficiaryId,
      address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2',
    })

    // Pre-insert an existing active RESERVED record (simulating pending reservation)
    mockDbState.fund_grant_reservations.push({
      beneficiary_id: beneficiaryId,
      attempt_id: 'pending-attempt-uuid',
      amount_php: '5000.00',
      status: 'RESERVED',
      created_at: new Date().toISOString(),
    })

    const subsidySpy = vi.fn()
    ;(StellarClient.create as any).mockResolvedValue(
      ok({
        hasAuthorizedTrustline: vi.fn().mockResolvedValue(ok(true)),
        allocateSubsidy: subsidySpy,
      }),
    )

    const service = new BeneficiaryService(mockSupabaseClient)
    const busyResult = await service.allocateTierCredits(beneficiaryId)

    // Busy outcome must return explicit operator review message
    expect(busyResult.isErr()).toBe(true)
    if (busyResult.isErr()) {
      expect(busyResult.error._tag).toBe('validation')
      expect(busyResult.error.message).toBe('Pending funding reservation requires operator review')
    }
    // Must never submit to chain
    expect(subsidySpy).not.toHaveBeenCalled()
    expect(mockDbState.allocations.length).toBe(0)
    expect(Number(mockDbState.beneficiaries[0].credit_balance)).toBe(0)

    // Now test issued reservation outcome
    const issuedBeneficiary = '00000000-0000-4000-8000-000000000002'
    mockDbState.beneficiaries.push({
      id: issuedBeneficiary,
      credit_balance: 0,
      created_at: new Date().toISOString(),
      child_age_months: 0,
    })
    mockDbState.beneficiary_wallets.push({
      beneficiary_id: issuedBeneficiary,
      address: 'GCZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW3',
    })
    mockDbState.fund_grant_reservations.push({
      beneficiary_id: issuedBeneficiary,
      attempt_id: 'issued-attempt-uuid',
      amount_php: '5000.00',
      status: 'ISSUED',
      created_at: new Date().toISOString(),
    })

    const issuedResult = await service.allocateTierCredits(issuedBeneficiary)
    expect(issuedResult.isErr()).toBe(true)
    if (issuedResult.isErr()) {
      expect(issuedResult.error._tag).toBe('validation')
      expect(issuedResult.error.message).toMatch(/already has a prior allocation/i)
    }
    expect(subsidySpy).not.toHaveBeenCalled()
  })

  it.each([
      'missing_wallet',
      'wallet_lookup_error',
      'config_error',
      'client_error',
      'trustline_false',
      'trustline_error',
      'chain_failure',
      'chain_throw',
      'balance_update_error',
      'allocation_insert_error',
      'finalization_false',
      'finalization_error',
    ])('retains funds after %s and blocks another grant submission', async scenario => {
      mockDbState.fund_topups.push({ id: 'topup-funds', status: 'COMPLETED', net_amount_php: '5000.00' })
      const bId = '00000000-0000-4000-8000-000000000001'

      mockDbState.beneficiaries.push({
        id: bId,
        credit_balance: 0,
        created_at: new Date().toISOString(),
        child_age_months: 0, // Tier 1
      })

      if (scenario !== 'missing_wallet') {
        mockDbState.beneficiary_wallets.push({
          beneficiary_id: bId,
          address: testIssuer.publicKey(),
        })
      }

      const subsidy = vi.fn().mockImplementation(() => {
        if (scenario === 'chain_failure') return Promise.resolve(err(new OnchainError('Timeout submitting transaction', 504)))
        if (scenario === 'chain_throw') throw new Error('private backend detail')
        return Promise.resolve(ok({ hash: `hash-${scenario}`, ledger: 200 }))
      })
      ;(StellarClient.create as any).mockResolvedValue(
        scenario === 'client_error' ? err(new OnchainError('Chain client unavailable', 0)) : ok({
          hasAuthorizedTrustline: vi.fn().mockResolvedValue(
            scenario === 'trustline_error' ? err(new OnchainError('Trustline lookup unavailable', 0))
              : ok(scenario !== 'trustline_false'),
          ),
          allocateSubsidy: subsidy,
        }),
      )

      // Induce DB errors if specified scenario
      const originalFrom = mockSupabaseClient.from
      if (scenario === 'balance_update_error' || scenario === 'allocation_insert_error' || scenario === 'wallet_lookup_error') {
        mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
          if (scenario === 'wallet_lookup_error' && table === 'beneficiary_wallets') throw new Error('private backend detail')
          const builder = originalFrom(table)
          if (scenario === 'balance_update_error' && table === 'beneficiaries') {
            builder.update = vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: new Error('private backend detail') }),
                }),
                single: vi.fn().mockResolvedValue({ data: null, error: new Error('private backend detail') }),
              }),
            }))
          }
          if (scenario === 'allocation_insert_error' && table === 'allocations') {
            builder.insert = vi.fn().mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: new Error('private backend detail') }),
              }),
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('private backend detail') }),
              then: (onFulfilled: any) => Promise.resolve({ data: null, error: new Error('private backend detail') }).then(onFulfilled),
            }))
          }
          return builder
        })
      }

      const db = {
        ...mockSupabaseClient,
        rpc: (name: string, params: unknown) => name === 'mark_grant_funded' && scenario.startsWith('finalization_')
          ? Promise.resolve({ data: false, error: scenario === 'finalization_error' ? new Error('private backend detail') : null })
          : mockSupabaseClient.rpc(name, params),
      }
      const service = new BeneficiaryService(db as any)
      if (scenario === 'config_error') vi.stubEnv('PHPC_ISSUER_SECRET', '')
      const result = await service.allocateTierCredits(bId)

      // Restore mocks
      mockSupabaseClient.from = originalFrom

      // Result must report error
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.message).not.toContain('private backend detail')

      // INVARIANT: Reservation was acquired and REMAINS in 'RESERVED' status; never deleted or released
      const savedReservation = mockDbState.fund_grant_reservations.find((r) => r.beneficiary_id === bId)
      expect(savedReservation).toBeDefined()
      expect(savedReservation?.status).toBe('RESERVED')
      expect(savedReservation?.amount_php).toBe('5000.00')
      const beforeRetry = subsidy.mock.calls.length
      const retry = await service.allocateTierCredits(bId)
      expect(retry.isErr()).toBe(true)
      expect(subsidy.mock.calls).toHaveLength(beforeRetry)
  })

  it('reserve RPC unknown, null, or malformed is handled safely as PersistenceError without raw DB content', async () => {
    mockDbState.fund_topups.push({ id: 'topup-f', status: 'COMPLETED', net_amount_php: '10000.00' })
    const beneficiaryId = '00000000-0000-4000-8000-000000000001'
    mockDbState.beneficiaries.push({
      id: beneficiaryId,
      credit_balance: 0,
      created_at: new Date().toISOString(),
      child_age_months: 0,
    })
    mockDbState.beneficiary_wallets.push({
      beneficiary_id: beneficiaryId,
      address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2',
    })

    const db = { ...mockSupabaseClient, rpc: vi.fn().mockResolvedValue({
      data: null, error: new Error('relation "public.fund_grant_reservations" does not exist at character 42'),
    }) }
    const service = new BeneficiaryService(db as any)
    const errResult = await service.allocateTierCredits(beneficiaryId)

    expect(errResult.isErr()).toBe(true)
    if (errResult.isErr()) {
      expect(errResult.error._tag).toBe('persistence')
      // Must NOT leak raw database error content
      expect(errResult.error.message).toBe('Failed to reserve grant funding')
      expect(errResult.error.message).not.toContain('character 42')
      expect(errResult.error.message).not.toContain('relation')
    }

    // Case 2: Returns malformed / null data
    db.rpc.mockResolvedValue({ data: null, error: null })
    const nullResult = await service.allocateTierCredits(beneficiaryId)
    expect(nullResult.isErr()).toBe(true)
    if (nullResult.isErr()) {
      expect(nullResult.error._tag).toBe('persistence')
      expect(nullResult.error.message).toBe('Failed to reserve grant funding')
    }

    // Case 3: Returns unknown outcome
    db.rpc.mockResolvedValue({ data: { outcome: 'unknown_status' }, error: null })
    const unknownResult = await service.allocateTierCredits(beneficiaryId)
    expect(unknownResult.isErr()).toBe(true)
    if (unknownResult.isErr()) {
      expect(unknownResult.error._tag).toBe('persistence')
      expect(unknownResult.error.message).toBe('Failed to reserve grant funding')
    }

  })

  it('tier 1 (5000.00) and tier 2 (3500.00) compute exact amounts for reservation and allocation', async () => {
    mockDbState.fund_topups.push({ id: 'topup-funds', status: 'COMPLETED', net_amount_php: '20000.00' })

    const t1Id = '00000000-0000-4000-8000-000000000001'
    const t2Id = '00000000-0000-4000-8000-000000000002'

    mockDbState.beneficiaries.push(
      { id: t1Id, credit_balance: 0, created_at: new Date().toISOString(), child_age_months: 0 }, // Tier 1
      { id: t2Id, credit_balance: 0, created_at: new Date().toISOString(), child_age_months: 40 }, // Tier 2
    )
    mockDbState.beneficiary_wallets.push(
      { beneficiary_id: t1Id, address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW1' },
      { beneficiary_id: t2Id, address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW2' },
    )

    ;(StellarClient.create as any).mockResolvedValue(
      ok({
        hasAuthorizedTrustline: vi.fn().mockResolvedValue(ok(true)),
        allocateSubsidy: vi.fn().mockResolvedValue(ok({ hash: 'txhash', ledger: 10 })),
      }),
    )

    const service = new BeneficiaryService(mockSupabaseClient)

    const r1 = await service.allocateTierCredits(t1Id)
    expect(r1.isOk()).toBe(true)
    if (r1.isOk()) {
      expect(r1.value.amount).toBe(5000)
    }
    const res1 = mockDbState.fund_grant_reservations.find((r) => r.beneficiary_id === t1Id)
    expect(res1?.amount_php).toBe('5000.00')
    const alloc1 = mockDbState.allocations.find((a) => a.beneficiary_id === t1Id)
    expect(alloc1?.amount_phpc).toBe(5000)
    expect(alloc1?.tier).toBe(1)

    const r2 = await service.allocateTierCredits(t2Id)
    expect(r2.isOk()).toBe(true)
    if (r2.isOk()) {
      expect(r2.value.amount).toBe(3500)
    }
    const res2 = mockDbState.fund_grant_reservations.find((r) => r.beneficiary_id === t2Id)
    expect(res2?.amount_php).toBe('3500.00')
    const alloc2 = mockDbState.allocations.find((a) => a.beneficiary_id === t2Id)
    expect(alloc2?.amount_phpc).toBe(3500)
    expect(alloc2?.tier).toBe(2)
  })

  it('finalization occurs only after stored allocation and matches attempt', async () => {
    mockDbState.fund_topups.push({ id: 'topup-funds', status: 'COMPLETED', net_amount_php: '20000.00' })
    const beneficiaryId = '00000000-0000-4000-8000-000000000001'
    mockDbState.beneficiaries.push({
      id: beneficiaryId,
      credit_balance: 0,
      created_at: new Date().toISOString(),
      child_age_months: 0,
    })
    mockDbState.beneficiary_wallets.push({
      beneficiary_id: beneficiaryId,
      address: 'GBZFCMQFAKQTAC7THZMRGVBM5QXRDRFEJXT6XLBRIAAGIQCH5WGE2PW1',
    })

    let allocationStoredBeforeFinalization = false
    let attemptIdMatched = false

    const db = { ...mockSupabaseClient, rpc: async (name: string, params: any) => {
      if (name === 'mark_grant_funded') {
      const bId = params.p_beneficiary_id
      const attemptId = params.p_attempt_id
      // Verify that at the time markGrantIssued is called:
      // 1. Allocation is already stored in DB with hash and amount
      const alloc = mockDbState.allocations.find((a) => a.beneficiary_id === bId)
      allocationStoredBeforeFinalization = Boolean(alloc && alloc.onchain_tx_hash && alloc.amount_phpc === 5000)

      // 2. The attemptId matches the reservation's attempt_id
      const res = mockDbState.fund_grant_reservations.find((r) => r.beneficiary_id === bId)
      attemptIdMatched = Boolean(res && res.attempt_id === attemptId)

      }
      return mockSupabaseClient.rpc(name, params)
    } }

    ;(StellarClient.create as any).mockResolvedValue(
      ok({
        hasAuthorizedTrustline: vi.fn().mockResolvedValue(ok(true)),
        allocateSubsidy: vi.fn().mockResolvedValue(ok({ hash: 'txhash-final', ledger: 42 })),
      }),
    )

    const service = new BeneficiaryService(db as any)
    const result = await service.allocateTierCredits(beneficiaryId)

    expect(result.isOk()).toBe(true)
    expect(allocationStoredBeforeFinalization).toBe(true)
    expect(attemptIdMatched).toBe(true)

    const finalReservation = mockDbState.fund_grant_reservations.find((r) => r.beneficiary_id === beneficiaryId)
    expect(finalReservation?.status).toBe('ISSUED')
  })

  it('does not expose an unexpected backend failure and keeps its funding reservation', async () => {
    const beneficiaryId = '00000000-0000-4000-8000-000000000001'
    mockDbState.fund_topups.push({ status: 'COMPLETED', net_amount_php: '5000.00' })
    mockDbState.beneficiaries.push({ id: beneficiaryId, credit_balance: 0,
      created_at: new Date().toISOString(), child_age_months: 0 })
    mockDbState.beneficiary_wallets.push({ beneficiary_id: beneficiaryId, address: testIssuer.publicKey() })
    vi.mocked(StellarClient.create).mockRejectedValue(new Error('private backend detail'))

    const service = new BeneficiaryService(mockSupabaseClient)
    const result = await service.allocateTierCredits(beneficiaryId)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).not.toContain('private backend detail')
    expect(mockDbState.fund_grant_reservations).toEqual([
      expect.objectContaining({ beneficiary_id: beneficiaryId, amount_php: '5000.00', status: 'RESERVED' }),
    ])
    const retry = await service.allocateTierCredits(beneficiaryId)
    expect(retry.isErr()).toBe(true)
    if (retry.isErr()) expect(retry.error.message).toContain('operator review')
    expect(mockDbState.allocations).toHaveLength(0)
    expect(mockDbState.beneficiaries[0].credit_balance).toBe(0)
  })

  it('keeps a reservation after its response is lost and blocks a retry before chain work', async () => {
    const beneficiaryId = '00000000-0000-4000-8000-000000000001'
    mockDbState.fund_topups.push({ status: 'COMPLETED', net_amount_php: '5000.00' })
    mockDbState.beneficiaries.push({ id: beneficiaryId, credit_balance: 0,
      created_at: new Date().toISOString(), child_age_months: 0 })
    let lostReply = true
    const db = { ...mockSupabaseClient, rpc: async (name: string, params: unknown) => {
      const response = await mockSupabaseClient.rpc(name, params)
      if (name === 'reserve_grant_funding' && lostReply) {
        lostReply = false
        return { data: null, error: new Error('Response lost after commit') }
      }
      return response
    } }
    const service = new BeneficiaryService(db as any)

    const first = await service.allocateTierCredits(beneficiaryId)
    expect(first.isErr()).toBe(true)
    if (first.isErr()) expect(first.error._tag).toBe('persistence')
    const reservation = { ...mockDbState.fund_grant_reservations[0] }
    const retry = await service.allocateTierCredits(beneficiaryId)
    expect(retry.isErr()).toBe(true)
    if (retry.isErr()) expect(retry.error.message).toContain('operator review')
    expect(mockDbState.fund_grant_reservations).toEqual([reservation])
    expect(reservation.status).toBe('RESERVED')
    expect(mockDbState.allocations).toHaveLength(0)
    expect(mockDbState.beneficiaries[0].credit_balance).toBe(0)
    expect(StellarClient.create).not.toHaveBeenCalled()
  })
})
