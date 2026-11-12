// BE1 owns this file. Requirements: PayPal fund contract.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ok, err, PayPalError } from '../lib/errors.js'
const mocks = vi.hoisted(() => ({ create: vi.fn(), capture: vi.fn(), ledger: vi.fn() }))
vi.mock('../services/fund.service.js', () => ({ FundService: vi.fn().mockImplementation(() => mocks) }))
vi.mock('../lib/supabase.js', () => ({ createServiceClient: () => ({ auth: { getUser: async (token: string) => ({
  data: { user: ['admin', 'merchant'].includes(token) ? { id: `user-${token}`, app_metadata: { role: token } } : null }, error: null,
}) } }) }))
vi.mock('../middleware/rate-limit.js', () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }))
vi.mock('../middleware/request-logger.js', () => ({ requestLogger: async (_c: unknown, next: () => Promise<void>) => next() }))
import { app } from '../app.js'
const id = 'f4ee46f7-d82e-4c9d-b1e3-febff1d73caf'
const orderId = '5O190127TN364715T'
const row = { id, amount_php: '50.00', status: 'COMPLETED', paypal_order_id: orderId, paypal_capture_id: '3C679366HH908993F', fee_php: '16.70', net_amount_php: '33.30', created_at: '2026-11-12T00:00:00Z', completed_at: '2026-11-12T00:01:00Z' }
function request(path: string, role?: string, body?: unknown) {
  return app.request('/api/fund'+path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(role ? { Authorization: 'Bearer '+role } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue(ok({ topup: row, approvalUrl: null }))
  mocks.capture.mockResolvedValue(ok({ topup: row, approvalUrl: null }))
  mocks.ledger.mockResolvedValue(ok({ summary: { gross_contributions_php: '50.00', fees_php: '16.70', net_contributions_php: '33.30', grants_issued_php: '100.00', grant_count: 1, confirmed_sales_php: '75.00', paid_invoices_php: '50.00', owed_php: '25.00', backed_grants_php: '0.00', available_to_grant_php: '33.30' }, topups: [row] }))
})
describe('Fund routes and mounted access rules', () => {
  it('permits guest create and capture and returns only safe receipt fields', async () => {
    const created = await request('/topups', undefined, { requestId: id, amountPhp: '50.00' })
    expect(created.status).toBe(200)
    expect(created.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.create).toHaveBeenCalledWith({ requestId: id, amountPhp: '50.00' })
    expect(await created.json()).toMatchObject({ amountPhp: '50.00', feePhp: '16.70', netAmountPhp: '33.30', status: 'COMPLETED' })
    expect((await request(`/topups/${orderId}/capture`, undefined, {})).status).toBe(200)
    expect(mocks.capture).toHaveBeenCalledWith(orderId)
  })
  it('keeps the ledger admin-only', async () => {
    expect((await request('/ledger')).status).toBe(401)
    expect((await request('/ledger', 'merchant')).status).toBe(403)
    const response = await request('/ledger', 'admin')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ grossContributionsPhp: '50.00', feesPhp: '16.70', netContributionsPhp: '33.30', owedPhp: '25.00' })
  })
  it('rejects invalid inputs and oversized or malformed JSON before service calls', async () => {
    expect((await request('/topups', undefined, { requestId: id, amountPhp: '1e3' })).status).toBe(400)
    expect((await request('/topups', undefined, { requestId: id, amountPhp: '50.00', returnUrl: 'https://evil.test' })).status).toBe(400)
    expect((await request('/topups/bad/capture', undefined, {})).status).toBe(400)
    expect((await request('/topups', undefined, { junk: 'x'.repeat(2000) })).status).toBe(413)
    expect((await app.request('/api/fund/topups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.capture).not.toHaveBeenCalled()
  })
  it('maps an upstream error without leaking its raw response', async () => {
    mocks.capture.mockResolvedValue(err(new PayPalError('Sandbox capture failed. Retry the same contribution.')))
    const response = await request(`/topups/${orderId}/capture`, undefined, {})
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'paypal', message: 'Sandbox capture failed. Retry the same contribution.' })
  })
})
