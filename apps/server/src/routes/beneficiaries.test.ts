// BE1 owns this file. Requirements: 4.1-4.9, funded grant contract.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ok, err, ValidationError, PersistenceError } from '../lib/errors.js'

const mockAllocateTierCredits = vi.fn()

vi.mock('../services/beneficiary.service.js', () => {
  return {
    BeneficiaryService: vi.fn().mockImplementation(() => ({
      allocateTierCredits: mockAllocateTierCredits,
    })),
  }
})

vi.mock('../lib/supabase.js', () => ({
  createServiceClient: () => ({
    auth: {
      getUser: async (token: string) => ({
        data: {
          user: token === 'admin' ? { id: 'admin-user', app_metadata: { role: 'admin' } } : null,
        },
        error: null,
      }),
    },
  }),
}))

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../middleware/request-logger.js', () => ({
  requestLogger: async (_c: unknown, next: () => Promise<void>) => next(),
}))

import { app } from '../app.js'

const beneficiaryId = '00000000-0000-4000-8000-000000000001'

function requestAllocation(id: string) {
  return app.request(`/api/beneficiaries/${id}/credits`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin',
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/beneficiaries/:id/credits — route boundary', () => {
  it('returns 200 with formatted beneficiary DTO and tx details on success', async () => {
    mockAllocateTierCredits.mockResolvedValue(
      ok({
        beneficiary: {
          id: beneficiaryId,
          guardian_name: 'Maria Dela Cruz',
          child_name: 'Juan Dela Cruz',
          child_age_months: 6,
          credit_balance: 5000,
          tier: 1,
          created_at: '2026-11-12T00:00:00Z',
        },
        amount: 5000,
        txHash: 'stellarhash123',
      }),
    )

    const res = await requestAllocation(beneficiaryId)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      amount: 5000,
      txHash: 'stellarhash123',
      beneficiary: {
        id: beneficiaryId,
        creditBalance: 5000,
      },
    })
    expect(mockAllocateTierCredits).toHaveBeenCalledWith(beneficiaryId)
  })

  it('maps insufficient grant funding to 400 validation error', async () => {
    mockAllocateTierCredits.mockResolvedValue(
      err(new ValidationError('Insufficient grant funding: needed 5000.00 PHP, available 0.00 PHP')),
    )

    const res = await requestAllocation(beneficiaryId)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({
      error: 'validation',
      message: 'Insufficient grant funding: needed 5000.00 PHP, available 0.00 PHP',
    })
  })

  it('maps pending funding reservation (busy) to 400 operator review error', async () => {
    mockAllocateTierCredits.mockResolvedValue(
      err(new ValidationError('Pending funding reservation requires operator review')),
    )

    const res = await requestAllocation(beneficiaryId)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({
      error: 'validation',
      message: 'Pending funding reservation requires operator review',
    })
  })

  it('maps persistence error safely to 500 without leaking raw database details', async () => {
    mockAllocateTierCredits.mockResolvedValue(
      err(new PersistenceError('Failed to reserve grant funding', 'fund_grant_reservations')),
    )

    const res = await requestAllocation(beneficiaryId)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({
      error: 'persistence',
      message: 'Failed to reserve grant funding',
    })
  })
})
