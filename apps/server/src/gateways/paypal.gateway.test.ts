// BE1 owns this file. Requirements: PayPal settlement contract, section 4.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PayPalGateway } from './paypal.gateway.js'

const config = { clientId: 'client', clientSecret: 'client-secret', payerEmail: 'payer@example.com', apiBase: 'https://api-m.sandbox.paypal.com' }
const id = 'a47ac10b-58cc-4372-a567-0e02b2c3d479'
const invoice = { id: 'INV2-TEST', status: 'SENT', detail: { reference: id, metadata: { recipient_view_url: 'https://www.sandbox.paypal.com/invoice/p/test' } }, amount: { currency_code: 'PHP', value: '10.10' } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const token = () => json({ access_token: 'access-secret', expires_in: 3600 })

afterEach(() => vi.restoreAllMocks())

describe('PayPal gateway', () => {
  it('caches the token and refreshes 60 seconds before expiry', async () => {
    let now = 0
    const fetcher = vi.fn().mockImplementation(async () => token())
    const gateway = new PayPalGateway(config, fetcher, () => now)
    await gateway.getToken(id)
    await gateway.getToken(id)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = 3540000
    await gateway.getToken(id)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', body: 'grant_type=client_credentials', redirect: 'error' })
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('PayPal-Request-Id')
  })

  it('creates a PHP sale item, accepts a create link, sends, and reads the payer URL', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(token())
      .mockResolvedValueOnce(json({ href: `${config.apiBase}/v2/invoicing/invoices/INV2-TEST`, rel: 'self', method: 'GET' }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(json(invoice))
    const gateway = new PayPalGateway(config, fetcher)
    expect(await gateway.createDraft(id, [{ transactionId: id, amountPhp: '10.10', soldAt: '2026-11-12T00:00:00Z', itemNames: ['Rice'] }])).toMatchObject({ value: 'INV2-TEST' })
    const sent = await gateway.send(id, 'INV2-TEST')
    expect(sent.isOk()).toBe(true)
    expect(await gateway.get(id, 'INV2-TEST')).toMatchObject({ value: { id: 'INV2-TEST', payUrl: invoice.detail.metadata.recipient_view_url } })
    const request = JSON.parse(fetcher.mock.calls[1][1].body)
    expect(request).toMatchObject({ detail: { reference: id, currency_code: 'PHP' }, primary_recipients: [{ billing_info: { email_address: config.payerEmail } }], items: [{ name: `Sale ${id.slice(0, 8)}`, quantity: '1', unit_amount: { currency_code: 'PHP', value: '10.10' }, description: 'Rice; 2026-11-12T00:00:00Z' }] })
    expect(fetcher.mock.calls[1][1].headers['PayPal-Request-Id']).not.toBe(fetcher.mock.calls[2][1].headers['PayPal-Request-Id'])
    expect(fetcher.mock.calls[1][1].headers.Prefer).toBe('return=representation')
    expect(fetcher.mock.calls[2][1].headers).not.toHaveProperty('Prefer')
  })

  it.each(['https://api-m.sandbox.paypal.com', 'https://api.sandbox.paypal.com'])('extracts a draft id from %s without calling that response link', async origin => {
    const fetcher = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ href: `${origin}/v2/invoicing/invoices/INV2-TEST` }))
    const gateway = new PayPalGateway(config, fetcher)
    expect(await gateway.createDraft(id, [])).toMatchObject({ value: 'INV2-TEST' })
    expect(fetcher.mock.calls.every(([url]) => new URL(url).origin === config.apiBase)).toBe(true)
  })

  it.each([
    'https://api-m.paypal.com/v2/invoicing/invoices/INV2-TEST',
    'https://api.sandbox.paypal.com.evil.test/v2/invoicing/invoices/INV2-TEST',
    'http://api.sandbox.paypal.com/v2/invoicing/invoices/INV2-TEST',
    'https://user:secret@api.sandbox.paypal.com/v2/invoicing/invoices/INV2-TEST',
    'https://api.sandbox.paypal.com/v2/invoicing/invoices/not-an-invoice',
    'https://api.sandbox.paypal.com/v2/invoicing/invoices/INV2-TEST?redirect=1',
    'https://api.sandbox.paypal.com/v2/invoicing/invoices/INV2-TEST#fragment',
  ])('rejects an unsafe draft resource link %s', async href => {
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ href })))
    expect((await gateway.createDraft(id, [])).isErr()).toBe(true)
  })

  it.each(['invalid', 'INV2-', 'INV2-TEST/other', 'INV2-TEST?query'])('rejects malformed draft id %s', async remoteId => {
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ id: remoteId })))
    expect((await gateway.createDraft(id, [])).isErr()).toBe(true)
  })

  it('accepts an expanded create response', async () => {
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json(invoice)))
    expect(await gateway.createDraft(id, [{ transactionId: id, amountPhp: '10.10', soldAt: '', itemNames: [] }])).toMatchObject({ value: 'INV2-TEST' })
  })

  it.each(['getToken', 'createDraft', 'send', 'get'] as const)('%s returns a safe error on transport failure', async (method) => {
    const fetcher = vi.fn().mockRejectedValue(new Error('client-secret access-secret private payer@example.com'))
    const gateway = new PayPalGateway(config, fetcher)
    const result = method === 'createDraft' ? await gateway.createDraft(id, []) : method === 'getToken' ? await gateway.getToken(id) : await gateway[method](id, 'INV2-TEST')
    expect(result.isErr()).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/client-secret|access-secret|payer@example.com/)
  })

  it.each([401, 429, 500])('handles HTTP %s without returning the upstream body', async (status) => {
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValue(json({ secret: 'client-secret' }, status)))
    const result = await gateway.getToken(id)
    expect(result.isErr()).toBe(true)
    expect(JSON.stringify(result)).not.toContain('client-secret')
  })

  it.each([{}, { access_token: '', expires_in: 5 }, { access_token: 't', expires_in: -1 }])('rejects a malformed token', async (body) => {
    expect((await new PayPalGateway(config, vi.fn().mockResolvedValue(json(body))).getToken(id)).isErr()).toBe(true)
  })

  it('rejects unsafe create links and malformed invoice detail', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(token()).mockResolvedValue(json({ href: 'https://evil.example/INV2-test', rel: 'self' }))
    const gateway = new PayPalGateway(config, fetcher)
    expect((await gateway.createDraft(id, [])).isErr()).toBe(true)
    expect((await gateway.get(id, 'INV2-TEST')).isErr()).toBe(true)
  })

  it.each(['https://www.paypal.com/invoice/p/test', 'https://evil.example/invoice', 'javascript:alert(1)', 'https://name:secret@www.sandbox.paypal.com/invoice/p/test'])('rejects unsafe payer URL %s', async payUrl => {
    const body = { ...invoice, detail: { reference: id, metadata: { recipient_view_url: payUrl } } }
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json(body)))
    expect((await gateway.get(id, 'INV2-TEST')).isErr()).toBe(true)
  })

  it('reuses POST keys on retries and does not cache rejected token requests', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(token())
      .mockResolvedValueOnce(json({ id: 'INV2-TEST' })).mockResolvedValueOnce(json({ id: 'INV2-TEST' }))
    const gateway = new PayPalGateway(config, fetcher)
    expect((await gateway.getToken(id)).isErr()).toBe(true)
    const sales = [{ transactionId: id, amountPhp: '10.10', soldAt: '', itemNames: [] }]
    await gateway.createDraft(id, sales)
    await gateway.createDraft(id, sales)
    expect(fetcher.mock.calls[2][1].headers['PayPal-Request-Id']).toBe(fetcher.mock.calls[3][1].headers['PayPal-Request-Id'])
    expect(JSON.parse(fetcher.mock.calls[2][1].body).detail.invoice_number).toHaveLength(25)
  })
})
