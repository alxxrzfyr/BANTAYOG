import { describe, expect, it, vi } from 'vitest'
import { PayPalGateway } from './paypal.gateway.js'

const id = 'f4ee46f7-d82e-4c9d-b1e3-febff1d73caf'
const orderId = '5O190127TN364715T'
const config = { clientId: 'client', clientSecret: 'private-secret', payerEmail: 'test@example.com', apiBase: 'https://api-m.sandbox.paypal.com' }
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const token = () => json({ access_token: 'access-secret', expires_in: 3600 })
const remote = { id: orderId, status: 'APPROVED', intent: 'CAPTURE', purchase_units: [{ reference_id: id, amount: { currency_code: 'PHP', value: '50.00' } }], links: [{ rel: 'approve', href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}` }] }

describe('PayPal Orders v2 gateway', () => {
  it.each([[], [remote.purchase_units[0], remote.purchase_units[0]], [{ ...remote.purchase_units[0], amount: { currency_code: 'PHP', value: '50.001' } }]])('rejects invalid purchase-unit proof', async purchase_units => {
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ ...remote, purchase_units })))
    expect((await gateway.getOrder(id, orderId)).isErr()).toBe(true)
  })
  it('rejects a malformed remote order ID before exposing checkout', async () => {
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ id: '../capture' })))
    expect((await gateway.createOrder(id, '50.00', 'http://localhost:3000')).isErr()).toBe(true)
  })
  it('creates a fixed PHP order, then reads proof through the fixed API host', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ id: orderId })).mockResolvedValueOnce(json(remote))
    const gateway = new PayPalGateway(config, fetcher)
    expect(await gateway.createOrder(id, '50.00', 'http://localhost:3000')).toMatchObject({ value: orderId })
    expect(await gateway.getOrder(id, orderId)).toMatchObject({ value: { id: orderId, reference: id, currency: 'PHP', amount: '50.00', status: 'APPROVED', captures: [] } })
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ intent: 'CAPTURE', purchase_units: [{ reference_id: id, invoice_id: `BT-FUND-${id}`, amount: { currency_code: 'PHP', value: '50.00' } }], payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', return_url: 'http://localhost:3000/fund?result=approved', cancel_url: 'http://localhost:3000/fund?result=cancelled' } } } })
    expect(fetcher.mock.calls[1][1].headers).toMatchObject({ Prefer: 'return=representation', 'PayPal-Request-Id': expect.any(String) })
    expect(fetcher.mock.calls.every(([url]) => new URL(url).origin === config.apiBase)).toBe(true)
  })
  it.each(['https://www.paypal.com/checkoutnow?token='+orderId, 'https://evil.test/checkoutnow?token='+orderId, 'https://user:pass@www.sandbox.paypal.com/checkoutnow?token='+orderId, 'https://www.sandbox.paypal.com/checkoutnow?token=OTHER', 'https://www.sandbox.paypal.com/elsewhere?token='+orderId])('rejects unsafe approval link %s', async href => {
    const gateway = new PayPalGateway(config, vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ ...remote, links: [{ rel: 'approve', href }] })))
    expect((await gateway.getOrder(id, orderId)).isErr()).toBe(true)
  })
  it('reads the full order after capture, keeps fees separate, and uses a distinct request key', async () => {
    const capture = { id: '3C679366HH908993F', status: 'COMPLETED', final_capture: true, amount: { currency_code: 'PHP', value: '50.00' }, seller_receivable_breakdown: { gross_amount: { currency_code: 'PHP', value: '50.00' }, paypal_fee: { currency_code: 'PHP', value: '16.70' }, net_amount: { currency_code: 'PHP', value: '33.30' } } }
    const completed = { ...remote, status: 'COMPLETED', purchase_units: [{ ...remote.purchase_units[0], payments: { captures: [capture] } }], links: [] }
    const fetcher = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ id: orderId })).mockResolvedValueOnce(json(completed))
    const result = await new PayPalGateway(config, fetcher).captureOrder(id, orderId)
    expect(result).toMatchObject({ value: { status: 'COMPLETED', captures: [{ id: capture.id, final: true, amount: '50.00', fee: '16.70', net: '33.30' }] } })
    expect(fetcher.mock.calls[1][0]).toBe(`${config.apiBase}/v2/checkout/orders/${orderId}/capture`)
    expect(fetcher.mock.calls[2][0]).toBe(`${config.apiBase}/v2/checkout/orders/${orderId}`)
    expect(fetcher.mock.calls[1][1]).toMatchObject({ redirect: 'error', headers: { Prefer: 'return=representation', 'PayPal-Request-Id': id.replaceAll('-', '')+'-op' } })
  })
  it.each(['createOrder', 'getOrder', 'captureOrder'] as const)('returns a safe expected failure from %s', async method => {
    const gateway = new PayPalGateway(config, vi.fn().mockRejectedValue(new Error('private-secret access-secret')))
    const result = method === 'createOrder' ? await gateway.createOrder(id, '50.00', 'http://localhost:3000') : await gateway[method](id, orderId)
    expect(result.isErr()).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/private-secret|access-secret/)
  })
})
