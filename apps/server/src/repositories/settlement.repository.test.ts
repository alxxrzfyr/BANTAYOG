// BE1 owns this file. Requirements: PayPal settlement contract, sections 3 and 9.
import { describe, expect, it, vi } from 'vitest'
import { SettlementRepository } from './settlement.repository.js'

function createDb(results: { data?: unknown; error?: unknown }[] = []) {
  const queries: any[] = []
  const db = {
    from: vi.fn(() => {
      const result = { data: null, error: null, ...results.shift() }
      const query: any = { then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) }
      for (const method of ['select', 'eq', 'in', 'is', 'order', 'range', 'update', 'maybeSingle', 'single']) query[method] = vi.fn().mockReturnValue(query)
      queries.push(query)
      return query
    }),
    rpc: vi.fn().mockResolvedValue({ data: 'invoice', error: null }),
  }
  return { db, queries, repository: new SettlementRepository(db as never) }
}

describe('SettlementRepository', () => {
  it('marks a proposal sent and backfills only an empty URL on an already sent invoice', async () => {
    const { repository, queries } = createDb()
    await repository.markSent('invoice', 'INV2-TEST', 'sent-time', 'https://www.sandbox.paypal.com/invoice/p/test')
    expect(queries[0].update).toHaveBeenCalledWith({ status: 'SENT', sent_at: 'sent-time', paypal_invoice_url: 'https://www.sandbox.paypal.com/invoice/p/test' })
    expect(queries[0].eq).toHaveBeenCalledWith('status', 'PROPOSED')
    expect(queries).toHaveLength(2)
    expect(queries[1].update).toHaveBeenCalledWith({ paypal_invoice_url: 'https://www.sandbox.paypal.com/invoice/p/test' })
    expect(queries[1].eq.mock.calls).toEqual([['id', 'invoice'], ['paypal_invoice_id', 'INV2-TEST'], ['status', 'SENT']])
    expect(queries[1].is).toHaveBeenCalledWith('paypal_invoice_url', null)
  })
  it('can mark sent without a URL and does not clear an existing SENT URL', async () => {
    const { repository, queries } = createDb()
    await repository.markSent('invoice', 'INV2-TEST', 'sent-time', null)
    expect(queries).toHaveLength(1)
    expect(queries[0].eq).toHaveBeenCalledWith('status', 'PROPOSED')
  })
  it.each([null, 'https://www.sandbox.paypal.com/invoice/p/test'])('marks paid and preserves the old URL if the new URL is %s', async payUrl => {
    const { repository, queries } = createDb()
    await repository.markPaid('invoice', 'INV2-TEST', 'paid-time', payUrl)
    expect(queries[0].update).toHaveBeenCalledWith({ status: 'PAID', paid_at: 'paid-time', ...(payUrl === null ? {} : { paypal_invoice_url: payUrl }) })
    expect(queries[0].eq.mock.calls).toEqual([['id', 'invoice'], ['paypal_invoice_id', 'INV2-TEST'], ['status', 'SENT']])
  })
  it('saves a draft only on a proposal without a saved draft', async () => {
    const { repository, queries } = createDb()
    await repository.saveDraft('invoice', 'INV2-TEST')
    expect(queries[0].update).toHaveBeenCalledWith({ paypal_invoice_id: 'INV2-TEST' })
    expect(queries[0].eq.mock.calls).toEqual([['id', 'invoice'], ['status', 'PROPOSED']])
    expect(queries[0].is).toHaveBeenCalledWith('paypal_invoice_id', null)
  })
  it('loads an active invoice and ordered proof from the service views', async () => {
    const { repository, db, queries } = createDb([{ data: { id: 'invoice' } }, { data: { id: 'invoice' } }, { data: [{ transaction_id: 'sale' }] }])
    expect(await repository.findActive('merchant')).toEqual({ id: 'invoice' })
    expect(queries[0].eq).toHaveBeenCalledWith('merchant_id', 'merchant')
    expect(queries[0].in).toHaveBeenCalledWith('status', ['PROPOSED', 'SENT'])
    expect(await repository.getDetail('invoice')).toEqual({ id: 'invoice', lines: [{ transaction_id: 'sale' }] })
    expect(db.from).toHaveBeenCalledTimes(3)
    expect(queries[2].order.mock.calls).toEqual([['sold_at'], ['transaction_id']])
  })
  it('returns null for a missing invoice without reading lines', async () => {
    const { repository, queries } = createDb()
    expect(await repository.getDetail('missing')).toBeNull()
    expect(queries).toHaveLength(1)
  })
  it('uses empty proof when the line result is null', async () => {
    const { repository } = createDb([{ data: { id: 'invoice' } }])
    expect(await repository.getDetail('invoice')).toEqual({ id: 'invoice', lines: [] })
  })
  it('paginates invoice history with stable ordering and both filters', async () => {
    const page = Array.from({ length: 1000 }, (_, index) => ({ id: String(index) }))
    const { repository, queries } = createDb([{ data: page }, { data: [{ id: 'last' }] }])
    expect(await repository.list({ merchantId: 'merchant', status: 'SENT' })).toEqual([...page, { id: 'last' }])
    expect(queries[0].range).toHaveBeenCalledWith(0, 999)
    expect(queries[1].range).toHaveBeenCalledWith(1000, 1999)
    for (const query of queries) {
      expect(query.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]])
      expect(query.eq.mock.calls).toEqual([['merchant_id', 'merchant'], ['status', 'SENT']])
    }
  })
  it('returns empty invoice history when there are no rows', async () => {
    expect(await createDb().repository.list({})).toEqual([])
  })
  it('reads merchant totals and resolves the authenticated merchant', async () => {
    const { repository, queries } = createDb([{ data: { unpaid_amount_php: '10.10' } }, { data: { id: 'merchant', status: 'APPROVED' } }])
    expect(await repository.overview('merchant')).toEqual({ unpaid_amount_php: '10.10' })
    expect(await repository.findMerchantForUser('user')).toEqual({ id: 'merchant', status: 'APPROVED' })
    expect(queries[0].eq).toHaveBeenCalledWith('merchant_id', 'merchant')
    expect(queries[1].eq).toHaveBeenCalledWith('auth_user_id', 'user')
  })
  it('passes the reviewed sale set, approval and cancellation to SQL', async () => {
    const { repository, db } = createDb()
    db.rpc.mockResolvedValueOnce({ data: { id: 'invoice', created: true }, error: null })
    expect(await repository.createProposal('merchant', { aiSummary: 'Review.', held: [] }, ['sale'])).toEqual({ id: 'invoice', created: true })
    await repository.approve('invoice', 'admin', ['sale'])
    await repository.cancel('invoice', 'Review price.')
    expect(db.rpc.mock.calls).toEqual([
      ['create_settlement_proposal', { p_merchant_id: 'merchant', p_held: [], p_ai_summary: 'Review.', p_sale_ids: ['sale'] }],
      ['approve_settlement', { p_invoice_id: 'invoice', p_admin_id: 'admin', p_release: ['sale'] }],
      ['cancel_settlement', { p_invoice_id: 'invoice', p_reason: 'Review price.' }],
    ])
  })
  it.each(['findActive', 'getDetail', 'list', 'overview', 'findMerchantForUser', 'saveDraft', 'markSent', 'markPaid'] as const)('propagates %s query errors to the service', async method => {
    const error = { code: 'failed' }
    const { repository } = createDb([{ error }])
    const operation = method === 'list' ? repository.list({}) : ['saveDraft', 'markSent', 'markPaid'].includes(method)
      ? (repository[method] as any)('invoice', 'INV2-TEST', 'time', null) : (repository[method] as any)('id')
    await expect(operation).rejects.toEqual(error)
  })
  it('propagates proof and URL backfill errors', async () => {
    const error = { code: 'failed' }
    await expect(createDb([{ data: { id: 'invoice' } }, { error }]).repository.getDetail('invoice')).rejects.toEqual(error)
    await expect(createDb([{}, { error }]).repository.markSent('invoice', 'INV2-TEST', 'time', 'url')).rejects.toEqual(error)
  })
  it.each(['createProposal', 'approve', 'cancel'] as const)('propagates %s RPC errors to the service', async method => {
    const { repository, db } = createDb()
    const error = { code: '22023' }
    db.rpc.mockResolvedValue({ data: null, error })
    await expect(method === 'createProposal' ? repository.createProposal('merchant', { held: [], aiSummary: '' }, ['sale'])
      : method === 'approve' ? repository.approve('invoice', 'admin', []) : repository.cancel('invoice', 'reason')).rejects.toEqual(error)
  })
})
