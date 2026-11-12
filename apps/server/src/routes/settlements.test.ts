// BE1 owns this file. Requirements: PayPal settlement contract, sections 6 and 9.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ok, err, PersistenceError, PayPalError, ValidationError } from '../lib/errors.js'

const mocks = vi.hoisted(() => ({
  merchantForUser: vi.fn(), propose: vi.fn(), get: vi.fn(), list: vi.fn(), overview: vi.fn(),
  approve: vi.fn(), reject: vi.fn(), refresh: vi.fn(),
}))
vi.mock('../services/settlement.service.js', () => ({ SettlementService: vi.fn().mockImplementation(() => mocks) }))
vi.mock('../lib/supabase.js', () => ({ createServiceClient: () => ({ auth: { getUser: async (token: string) => ({
  data: { user: ['admin', 'merchant'].includes(token) ? { id: `user-${token}`, app_metadata: { role: token } } : null }, error: null,
}) } }) }))
vi.mock('../middleware/rate-limit.js', () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }))
vi.mock('../middleware/request-logger.js', () => ({ requestLogger: async (_c: unknown, next: () => Promise<void>) => next() }))

import { app } from '../app.js'

const id = 'a47ac10b-58cc-4372-a567-0e02b2c3d479'
const merchantId = 'b47ac10b-58cc-4372-a567-0e02b2c3d479'
const row = { id, merchant_id: merchantId, store_name: 'Store', status: 'PROPOSED', total_amount_php: '10.10', held_amount_php: '0.00', ai_summary: 'Review.',
  paypal_invoice_id: null, paypal_invoice_url: null, approved_by: null, created_at: '2026-11-12T00:00:00Z', sent_at: null, paid_at: null, lines: [] }
const merchantPath = '/api/merchants/me/settlements'
const adminPath = '/api/settlements'
function request(path: string, role: string | null, method = 'GET', body?: unknown) {
  return app.request(path, { method, headers: { ...(role ? { Authorization: `Bearer ${role}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.merchantForUser.mockResolvedValue(ok(merchantId))
  mocks.propose.mockResolvedValue(ok({ invoice: row, created: true }))
  mocks.get.mockResolvedValue(ok(row))
  mocks.list.mockResolvedValue(ok([row]))
  mocks.overview.mockResolvedValue(ok({ unpaid_sale_count: 1, unpaid_amount_php: '10.10', waiting_for_ledger_count: 2, paid_amount_php: '0.00', invoices: [row] }))
  mocks.approve.mockResolvedValue(ok({ ...row, approved_by: 'user-admin', status: 'SENT', paypal_invoice_url: 'https://www.sandbox.paypal.com/invoice/p/test' }))
  mocks.reject.mockResolvedValue(ok({ ...row, status: 'CANCELLED' }))
  mocks.refresh.mockResolvedValue(ok({ ...row, approved_by: 'user-admin', status: 'PAID' }))
})

describe('Settlement routes and mounted access rules', () => {
  it.each([merchantPath, adminPath])('returns approval state before a draft exists on %s', async path => {
    const role = path === merchantPath ? 'merchant' : 'admin'
    expect(await (await request(`${path}/${id}`, role)).json()).toMatchObject({ approved: false })
    mocks.get.mockResolvedValue(ok({ ...row, approved_by: 'user-admin' }))
    expect(await (await request(`${path}/${id}`, role)).json()).toMatchObject({ approved: true, paypalInvoiceId: null })
  })
  it.each([merchantPath, adminPath])('requires authentication at %s', async path => {
    const response = await request(path, null)
    expect(response.status).toBe(401)
  })
  it('denies merchants on admin routes and admins on merchant routes', async () => {
    expect((await request(adminPath, 'merchant')).status).toBe(403)
    expect((await request(merchantPath, 'admin')).status).toBe(403)
  })
  it('gets the merchant overview without detail lines', async () => {
    const response = await request(`${merchantPath}?merchantId=foreign`, 'merchant')
    expect(response.status).toBe(200)
    expect(mocks.merchantForUser).toHaveBeenCalledWith('user-merchant')
    expect(mocks.overview).toHaveBeenCalledWith(merchantId)
    expect(await response.json()).toMatchObject({ unpaidAmountPhp: '10.10', invoices: [{ id, approved: false }] })
  })
  it('returns 201 for creation and 200 for a reused invoice, ignoring a request merchant id', async () => {
    expect((await request(merchantPath, 'merchant', 'POST', { merchantId: 'foreign' })).status).toBe(201)
    expect(mocks.propose).toHaveBeenCalledWith(merchantId)
    mocks.propose.mockResolvedValue(ok({ invoice: row, created: false }))
    expect((await request(merchantPath, 'merchant', 'POST')).status).toBe(200)
  })
  it('scopes merchant get and refresh to the authenticated profile', async () => {
    expect((await request(`${merchantPath}/${id}`, 'merchant')).status).toBe(200)
    expect(mocks.get).toHaveBeenCalledWith(id, merchantId)
    expect((await request(`${merchantPath}/${id}/refresh`, 'merchant', 'POST')).status).toBe(200)
    expect(mocks.refresh).toHaveBeenCalledWith(id, merchantId)
  })
  it('lists by valid status and gets admin detail', async () => {
    expect((await request(`${adminPath}?status=PROPOSED`, 'admin')).status).toBe(200)
    expect(mocks.list).toHaveBeenCalledWith('PROPOSED')
    expect((await request(`${adminPath}/${id}`, 'admin')).status).toBe(200)
    expect(mocks.get).toHaveBeenCalledWith(id)
  })
  it('approves with validated releases and rejects with a validated reason', async () => {
    const response = await request(`${adminPath}/${id}/approve`, 'admin', 'POST', { releaseTransactionIds: [id] })
    expect(response.status).toBe(200)
    expect(mocks.approve).toHaveBeenCalledWith(id, 'user-admin', [id])
    expect(await response.json()).toMatchObject({ status: 'SENT', approved: true, payUrl: expect.any(String) })
    expect((await request(`${adminPath}/${id}/reject`, 'admin', 'POST', { reason: 'Check price.' })).status).toBe(200)
    expect(mocks.reject).toHaveBeenCalledWith(id, 'Check price.')
    expect((await request(`${adminPath}/${id}/refresh`, 'admin', 'POST')).status).toBe(200)
    expect(mocks.refresh).toHaveBeenCalledWith(id)
  })
  it('validates ids, query values, approval bodies, rejection bodies, and malformed JSON', async () => {
    expect((await request(`${adminPath}/bad`, 'admin')).status).toBe(400)
    expect((await request(`${merchantPath}/bad`, 'merchant')).status).toBe(400)
    expect((await request(`${adminPath}?status=INVALID`, 'admin')).status).toBe(400)
    expect((await request(`${adminPath}/${id}/approve`, 'admin', 'POST', { releaseTransactionIds: ['bad'] })).status).toBe(400)
    expect((await request(`${adminPath}/${id}/reject`, 'admin', 'POST', { reason: '' })).status).toBe(400)
    expect((await app.request(`${adminPath}/${id}/approve`, { method: 'POST', headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json' }, body: '{bad' })).status).toBe(400)
    expect(mocks.approve).not.toHaveBeenCalled()
  })
  it('maps service errors for merchant and admin routes', async () => {
    mocks.propose.mockResolvedValue(err(new ValidationError('No eligible sales.')))
    expect((await request(merchantPath, 'merchant', 'POST')).status).toBe(400)
    mocks.get.mockResolvedValue(err(new PersistenceError('Read failed.')))
    expect((await request(`${merchantPath}/${id}`, 'merchant')).status).toBe(500)
    expect((await request(`${adminPath}/${id}`, 'admin')).status).toBe(500)
    mocks.approve.mockResolvedValue(err(new PayPalError('PayPal unavailable.')))
    expect((await request(`${adminPath}/${id}/approve`, 'admin', 'POST', {})).status).toBe(502)
  })
})
