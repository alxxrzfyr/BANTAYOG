// BE1 owns this file. Requirements: PayPal settlement contract, sections 3-6 and 9.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettlementService } from './settlement.service.js'
import { ok, err, PayPalError, PersistenceError } from '../lib/errors.js'

const id = 'a47ac10b-58cc-4372-a567-0e02b2c3d479'
const merchantId = 'b47ac10b-58cc-4372-a567-0e02b2c3d479'
const saleId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
const env = { PAYPAL_CLIENT_ID: 'client', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_PROGRAM_PAYER_EMAIL: 'payer@example.com' }
const date = new Date('2026-11-12T12:00:00Z')
const base = () => ({
  id, merchant_id: merchantId, store_name: 'Store', status: 'PROPOSED', total_amount_php: '10.10', held_amount_php: '0.00',
  ai_summary: 'Review.', approved_by: null, paypal_invoice_id: null, paypal_invoice_url: null,
  created_at: date.toISOString(), sent_at: null, paid_at: null,
  lines: [{ id: 'line', invoice_id: id, transaction_id: saleId, amount_php: '10.10', held: false, hold_reason: null,
    sold_at: date.toISOString(), ledger_tx_hash: 'hash', item_list_jsonb: [{ name: 'Rice', category: 'GRAINS', quantity: 1, unitPricePhp: 10.1 }] }],
})
let row: any
let repository: any
let sales: any
let proposal: any
let gateway: any
let service: SettlementService

beforeEach(() => {
  row = base()
  repository = {
    findActive: vi.fn().mockResolvedValue(null),
    getDetail: vi.fn().mockImplementation(async () => structuredClone(row)),
    createProposal: vi.fn().mockImplementation(async () => {
      repository.findActive.mockResolvedValue(structuredClone(row))
      return { id, created: true }
    }),
    list: vi.fn().mockResolvedValue([row]),
    overview: vi.fn().mockResolvedValue({ merchant_id: merchantId, unpaid_sale_count: 1, unpaid_amount_php: '10.10', waiting_for_ledger_count: 2, paid_amount_php: '0.00' }),
    findMerchantForUser: vi.fn().mockResolvedValue({ id: merchantId, status: 'APPROVED' }),
    approve: vi.fn().mockImplementation(async () => { row.approved_by ??= 'admin'; return id }),
    cancel: vi.fn().mockImplementation(async () => { row.status = 'CANCELLED'; return id }),
    saveDraft: vi.fn().mockImplementation(async (_id: string, remoteId: string) => { row.paypal_invoice_id = remoteId }),
    markSent: vi.fn().mockImplementation(async (_id: string, _remoteId: string, sentAt: string, payUrl: string | null) => {
      if (row.status === 'PROPOSED') { row.status = 'SENT'; row.sent_at = sentAt; row.paypal_invoice_url = payUrl }
      if (row.status === 'SENT' && row.paypal_invoice_url === null && payUrl !== null) row.paypal_invoice_url = payUrl
    }),
    markPaid: vi.fn().mockImplementation(async (_id: string, _remoteId: string, paidAt: string, payUrl: string | null) => {
      if (row.status === 'SENT') { row.status = 'PAID'; row.paid_at = paidAt; if (payUrl !== null) row.paypal_invoice_url = payUrl }
    }),
  }
  sales = { findEligible: vi.fn().mockResolvedValue([{ id: saleId, merchant_id: merchantId, amount_php: '10.10', sold_at: date.toISOString(), ledger_tx_hash: 'hash', item_list_jsonb: [] }]) }
  proposal = { review: vi.fn().mockResolvedValue(ok({ held: [], aiSummary: 'Review.' })) }
  let remoteStatus = 'DRAFT'
  gateway = {
    createDraft: vi.fn().mockResolvedValue(ok('INV2-TEST')),
    send: vi.fn().mockImplementation(async () => { remoteStatus = 'SENT'; return ok(undefined) }),
    get: vi.fn().mockImplementation(async () => ok({ id: 'INV2-TEST', status: remoteStatus, reference: id, currency: 'PHP', amount: '10.10', payUrl: remoteStatus === 'DRAFT' ? null : 'https://www.sandbox.paypal.com/invoice/p/test' })),
  }
  service = new SettlementService({} as any, { repository, sales, proposal, gateway, env, currentDate: date })
})

describe('Settlement service', () => {
  it.each(['refresh', 'approve'] as const)('recovers a missing payer URL through %s after PayPal returns it', async action => {
    row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    const remote = { id: 'INV2-TEST', status: 'SENT', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }
    gateway.get.mockResolvedValue(ok(remote))
    expect(await service.refresh(id)).toMatchObject({ value: { status: 'SENT', paypal_invoice_url: null } })
    gateway.get.mockResolvedValue(ok({ ...remote, payUrl: 'https://www.sandbox.paypal.com/invoice/p/test' }))
    const result = action === 'refresh' ? await service.refresh(id) : await service.approve(id, 'admin')
    expect(result).toMatchObject({ value: { status: 'SENT', paypal_invoice_url: 'https://www.sandbox.paypal.com/invoice/p/test' } })
    expect(gateway.send).not.toHaveBeenCalled()
  })
  it.each(['SENT', 'UNPAID', 'PARTIALLY_PAID', 'PAYMENT_PENDING'] )('syncs remote %s on approval retry without another send', async status => {
    row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status, reference: id, currency: 'PHP', amount: '10.10', payUrl: 'https://www.sandbox.paypal.com/invoice/p/test' }))
    expect(await service.approve(id, 'admin')).toMatchObject({ value: { status: 'SENT' } })
    expect(gateway.send).not.toHaveBeenCalled()
  })
  it('accepts an already paid remote invoice without a payer URL', async () => {
    row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'PAID', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    expect(await service.approve(id, 'admin')).toMatchObject({ value: { status: 'PAID', paypal_invoice_url: null } })
    expect(gateway.send).not.toHaveBeenCalled()
  })
  it('preserves the saved payer URL when a paid response omits it', async () => {
    row.status = 'SENT'; row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    const savedUrl = 'https://www.sandbox.paypal.com/invoice/p/test'
    row.paypal_invoice_url = savedUrl
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'PAID', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    expect(await service.refresh(id)).toMatchObject({ value: { status: 'PAID', paypal_invoice_url: savedUrl } })
  })
  it('explains an all-held proposal before calling approval SQL', async () => {
    row.lines[0].held = true; row.lines[0].hold_reason = 'Review price.'; row.total_amount_php = '0.00'
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'validation', message: 'Release at least one held sale before approval, or reject the proposal.' } })
    expect(repository.approve).not.toHaveBeenCalled()
    expect(gateway.createDraft).not.toHaveBeenCalled()
  })
  it('allows SQL to release a held sale before approval', async () => {
    row.lines[0].held = true; row.lines[0].hold_reason = 'Review price.'; row.total_amount_php = '0.00'
    repository.approve.mockImplementationOnce(async () => {
      row.lines[0].held = false; row.lines[0].hold_reason = null; row.total_amount_php = '10.10'; row.approved_by = 'admin'
    })
    expect(await service.approve(id, 'admin', [saleId])).toMatchObject({ value: { status: 'SENT' } })
    expect(repository.approve).toHaveBeenCalledWith(id, 'admin', [saleId])
  })
  it('recovers a remote payment on approval retry without another send', async () => {
    row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'PAID', reference: id, currency: 'PHP', amount: '10.10', payUrl: 'https://www.sandbox.paypal.com/invoice/p/test' }))
    gateway.send.mockResolvedValue(err(new PayPalError('Paid invoices cannot be sent.')))
    expect(await service.approve(id, 'admin')).toMatchObject({ value: { status: 'PAID' } })
    expect(gateway.send).not.toHaveBeenCalled()
  })
  it('keeps paid approval and cancelled rejection safe to repeat', async () => {
    row.status = 'PAID'
    expect(await service.approve(id, 'admin')).toMatchObject({ value: { status: 'PAID' } })
    expect(gateway.send).not.toHaveBeenCalled()
    row.status = 'CANCELLED'
    expect(await service.reject(id, 'Check.')).toMatchObject({ value: { status: 'CANCELLED' } })
    expect(repository.cancel).not.toHaveBeenCalled()
  })
  it('returns a safe error when a draft id disappears during refresh', async () => {
    row.paypal_invoice_id = 'INV2-TEST'
    repository.getDetail.mockResolvedValueOnce(structuredClone(row)).mockResolvedValueOnce({ ...row, paypal_invoice_id: null })
    expect(await service.refresh(id)).toMatchObject({ error: { _tag: 'paypal' } })
    expect(gateway.get).not.toHaveBeenCalled()
  })
  it('propagates a second invoice read failure during refresh', async () => {
    row.paypal_invoice_id = 'INV2-TEST'
    repository.getDetail.mockResolvedValueOnce(structuredClone(row)).mockResolvedValueOnce(null)
    expect(await service.refresh(id)).toMatchObject({ error: { _tag: 'validation' } })
  })
  it('checks draft proof before sending it to the payer', async () => {
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'DRAFT', reference: id, currency: 'PHP', amount: '999.00', payUrl: null }))
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'paypal' } })
    expect(gateway.send).not.toHaveBeenCalled()
  })
  it('does not report successful approval before PayPal confirms send and a payer URL', async () => {
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'DRAFT', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'paypal' } })
    expect(row.status).toBe('PROPOSED')
  })
  it('does not send a remotely cancelled draft', async () => {
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'CANCELLED', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'paypal' } })
    expect(gateway.send).not.toHaveBeenCalled()
  })
  it('returns errors at approval reload boundaries and draft persistence conflicts', async () => {
    repository.getDetail.mockResolvedValueOnce(null)
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'validation' } })
    repository.getDetail.mockResolvedValueOnce(row).mockResolvedValueOnce(null)
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'validation' } })
    repository.getDetail.mockImplementation(async () => structuredClone(row))
    repository.saveDraft.mockResolvedValue(undefined)
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'paypal' } })
    expect(gateway.send).not.toHaveBeenCalled()
  })
  it('returns read failures during proposal lookup and after draft persistence', async () => {
    repository.findActive.mockResolvedValue(row)
    repository.getDetail.mockResolvedValue(null)
    expect(await service.propose(merchantId)).toMatchObject({ error: { _tag: 'validation' } })
    repository.findActive.mockResolvedValueOnce(null).mockResolvedValueOnce(row)
    sales.findEligible.mockResolvedValue([])
    expect(await service.propose(merchantId)).toMatchObject({ error: { _tag: 'validation' } })
    repository.getDetail.mockResolvedValueOnce(row).mockResolvedValueOnce(row).mockResolvedValueOnce(null)
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'validation' } })
  })
  it('handles refresh without config, remote mismatch, and a failed sent-status write', async () => {
    row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    const unconfigured = new SettlementService({} as any, { repository, sales, proposal, env: {} })
    expect(await unconfigured.refresh(id)).toMatchObject({ error: { _tag: 'validation' } })
    gateway.get.mockResolvedValueOnce(ok({ id: 'INV2-TEST', status: 'PAID', reference: id, currency: 'USD', amount: '10.10', payUrl: null }))
    expect(await service.refresh(id)).toMatchObject({ error: { _tag: 'paypal' } })
    repository.markSent.mockRejectedValue(new Error('write failed'))
    gateway.get.mockResolvedValueOnce(ok({ id: 'INV2-TEST', status: 'SENT', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    expect(await service.refresh(id)).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('makes one proposal, then returns that invoice on a second Get paid request', async () => {
    expect(await service.propose(merchantId)).toMatchObject({ value: { created: true, invoice: { id } } })
    expect(await service.propose(merchantId)).toMatchObject({ value: { created: false, invoice: { id } } })
    expect(repository.createProposal).toHaveBeenCalledTimes(1)
    expect(repository.createProposal).toHaveBeenCalledWith(merchantId, { held: [], aiSummary: 'Review.' }, [saleId])
    expect(gateway.createDraft).not.toHaveBeenCalled()
  })
  it('returns SQL reuse after concurrent proposal creation', async () => {
    repository.createProposal.mockResolvedValue({ id, created: false })
    expect(await service.propose(merchantId)).toMatchObject({ value: { created: false } })
  })
  it('returns an active invoice when another request reserves the sales first', async () => {
    sales.findEligible.mockResolvedValue([])
    repository.findActive.mockResolvedValueOnce(null).mockResolvedValueOnce(row)
    expect(await service.propose(merchantId)).toMatchObject({ value: { created: false } })
  })
  it('rejects no eligible sales', async () => {
    sales.findEligible.mockResolvedValue([])
    expect(await service.propose(merchantId)).toMatchObject({ error: { _tag: 'validation' } })
  })
  it('propagates proposal review failure', async () => {
    proposal.review.mockResolvedValue(err(new PersistenceError('References unavailable.')))
    expect(await service.propose(merchantId)).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it.each(['findActive', 'createProposal'])('handles propose persistence failure at %s', async method => {
    repository[method].mockRejectedValue(new Error('private database info'))
    const result = await service.propose(merchantId)
    expect(result).toMatchObject({ error: { _tag: 'persistence' } })
    expect(JSON.stringify(result)).not.toContain('private database info')
  })
  it('propagates a failed read after proposal creation', async () => {
    repository.getDetail.mockResolvedValue(null)
    expect(await service.propose(merchantId)).toMatchObject({ error: { _tag: 'validation' } })
  })
  it('gets invoice detail and enforces merchant ownership', async () => {
    expect(await service.get(id, merchantId)).toMatchObject({ value: { id, lines: expect.any(Array) } })
    expect(await service.get(id, 'another-merchant')).toMatchObject({ error: { _tag: 'auth' } })
    repository.getDetail.mockResolvedValue(null)
    expect(await service.get(id)).toMatchObject({ error: { _tag: 'validation' } })
    repository.getDetail.mockRejectedValue(new Error('read failed'))
    expect(await service.get(id)).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('lists invoices and returns list errors', async () => {
    expect(await service.list('PROPOSED')).toMatchObject({ value: [{ id }] })
    expect(repository.list).toHaveBeenCalledWith({ status: 'PROPOSED' })
    repository.list.mockRejectedValue(new Error('read failed'))
    expect(await service.list()).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('loads the SQL overview and merchant history, and returns read failures', async () => {
    expect(await service.overview(merchantId)).toMatchObject({ value: { unpaid_amount_php: '10.10', invoices: [{ id }] } })
    repository.overview.mockRejectedValue(new Error('read failed'))
    expect(await service.overview(merchantId)).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('resolves approved merchants and rejects missing or suspended profiles', async () => {
    expect(await service.merchantForUser('user')).toMatchObject({ value: merchantId })
    repository.findMerchantForUser.mockResolvedValue(null)
    expect(await service.merchantForUser('user')).toMatchObject({ error: { _tag: 'auth' } })
    repository.findMerchantForUser.mockResolvedValue({ id: merchantId, status: 'SUSPENDED' })
    expect(await service.merchantForUser('user')).toMatchObject({ error: { _tag: 'auth' } })
    repository.findMerchantForUser.mockRejectedValue(new Error('read failed'))
    expect(await service.merchantForUser('user')).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('approves, persists the draft before sending, and is safe to repeat', async () => {
    expect(await service.approve(id, 'admin')).toMatchObject({ value: { status: 'SENT' } })
    expect(await service.approve(id, 'admin')).toMatchObject({ value: { status: 'SENT' } })
    expect(gateway.createDraft).toHaveBeenCalledTimes(1)
    expect(gateway.send).toHaveBeenCalledTimes(1)
    expect(repository.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(gateway.send.mock.invocationCallOrder[0])
    expect(gateway.createDraft.mock.calls[0][1][0]).toMatchObject({ transactionId: saleId, amountPhp: '10.10' })
  })
  it('does not invoice held lines', async () => {
    row.lines.push({ ...row.lines[0], transaction_id: 'held-sale', held: true, hold_reason: 'Review price.' })
    await service.approve(id, 'admin')
    expect(gateway.createDraft.mock.calls[0][1]).toHaveLength(1)
  })
  it('resumes a persisted draft after send failure without creating another invoice', async () => {
    gateway.send.mockResolvedValueOnce(err(new PayPalError('Send failed.')))
    expect((await service.approve(id, 'admin')).isErr()).toBe(true)
    expect(row.paypal_invoice_id).toBe('INV2-TEST')
    expect((await service.approve(id, 'admin')).isOk()).toBe(true)
    expect(gateway.createDraft).toHaveBeenCalledTimes(1)
  })
  it('rejects cancelled approval and invalid release ids', async () => {
    row.status = 'CANCELLED'
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'validation' } })
    row.status = 'PROPOSED'
    expect(await service.approve(id, 'admin', ['foreign'])).toMatchObject({ error: { _tag: 'validation' } })
  })
  it('does not approve with missing PayPal configuration', async () => {
    service = new SettlementService({} as any, { repository, sales, proposal, env: {} })
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'validation' } })
    expect(repository.approve).not.toHaveBeenCalled()
  })
  it.each(['createDraft', 'send', 'get'])('propagates PayPal %s failure', async method => {
    gateway[method].mockResolvedValue(err(new PayPalError('Remote unavailable.')))
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'paypal' } })
    expect(repository.markSent).not.toHaveBeenCalled()
  })
  it.each(['approve', 'saveDraft', 'markSent'])('handles approval database failure at %s', async method => {
    repository[method].mockRejectedValue(new Error('write failed'))
    expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('maps SQL state conflicts without leaking SQL details', async () => {
    repository.approve.mockRejectedValue({ code: '22023', message: 'private SQL detail' })
    const result = await service.approve(id, 'admin')
    expect(result).toMatchObject({ error: { _tag: 'validation' } })
    expect(JSON.stringify(result)).not.toContain('private SQL detail')
  })
  it('rejects mismatched PayPal amounts, currency, id and reference', async () => {
    for (const change of [{ amount: '999.00' }, { currency: 'USD' }, { reference: 'foreign' }, { id: 'INV2-FOREIGN' }]) {
      gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'SENT', reference: id, currency: 'PHP', amount: '10.10', payUrl: null, ...change }))
      expect(await service.approve(id, 'admin')).toMatchObject({ error: { _tag: 'paypal' } })
    }
    expect(repository.markSent).not.toHaveBeenCalled()
  })
  it('rejects a proposal and returns cancellation errors', async () => {
    expect(await service.reject(id, 'Check prices.')).toMatchObject({ value: { status: 'CANCELLED' } })
    row = base()
    repository.cancel.mockRejectedValue(new Error('write failed'))
    expect(await service.reject(id, 'Check prices.')).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('rejects invalid reason, missing invoices, and approved or sent invoices', async () => {
    expect(await service.reject(id, '')).toMatchObject({ error: { _tag: 'validation' } })
    row.approved_by = 'admin'
    expect(await service.reject(id, 'Check.')).toMatchObject({ error: { _tag: 'validation' } })
    row.approved_by = null
    row.status = 'SENT'
    expect(await service.reject(id, 'Check.')).toMatchObject({ error: { _tag: 'validation' } })
    repository.getDetail.mockResolvedValue(null)
    expect(await service.reject(id, 'Check.')).toMatchObject({ error: { _tag: 'validation' } })
  })
  it('refreshes paid status, verifies remote amounts, and repeats without regression', async () => {
    row.status = 'SENT'; row.approved_by = 'admin'; row.paypal_invoice_id = 'INV2-TEST'
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'PAID', reference: id, currency: 'PHP', amount: '10.10', payUrl: 'https://www.sandbox.paypal.com/invoice/p/test' }))
    expect(await service.refresh(id, merchantId)).toMatchObject({ value: { status: 'PAID' } })
    expect(await service.refresh(id, merchantId)).toMatchObject({ value: { status: 'PAID' } })
    expect(repository.markPaid).toHaveBeenCalledTimes(1)
    expect(repository.markPaid.mock.calls[0][2]).toBe(date.toISOString())
  })
  it('keeps drafts and partially paid invoices unpaid', async () => {
    expect(await service.refresh(id)).toMatchObject({ value: { status: 'PROPOSED' } })
    row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'DRAFT', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    expect(await service.refresh(id)).toMatchObject({ value: { status: 'PROPOSED' } })
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'PARTIALLY_PAID', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    expect(await service.refresh(id)).toMatchObject({ value: { status: 'SENT' } })
    expect(repository.markPaid).not.toHaveBeenCalled()
  })
  it('enforces ownership before contacting PayPal', async () => {
    expect(await service.refresh(id, 'foreign')).toMatchObject({ error: { _tag: 'auth' } })
    expect(gateway.get).not.toHaveBeenCalled()
  })
  it('propagates refresh upstream and database failures', async () => {
    row.status = 'SENT'; row.paypal_invoice_id = 'INV2-TEST'; row.approved_by = 'admin'
    gateway.get.mockResolvedValueOnce(err(new PayPalError('Read failed.')))
    expect(await service.refresh(id)).toMatchObject({ error: { _tag: 'paypal' } })
    gateway.get.mockResolvedValue(ok({ id: 'INV2-TEST', status: 'PAID', reference: id, currency: 'PHP', amount: '10.10', payUrl: null }))
    repository.markPaid.mockRejectedValue(new Error('write failed'))
    expect(await service.refresh(id)).toMatchObject({ error: { _tag: 'persistence' } })
  })
})
