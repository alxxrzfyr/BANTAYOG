import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database, FundTopupRow } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FundService } from './fund.service.js'
import { FundRepository } from '../repositories/fund.repository.js'
import { PayPalGateway, type PayPalOrder, type PayPalOrderCapture } from '../gateways/paypal.gateway.js'
import { ok, err, PayPalError } from '../lib/errors.js'

const id = 'f4ee46f7-d82e-4c9d-b1e3-febff1d73caf'
const orderId = '5O190127TN364715T'
const initial: FundTopupRow = { id, amount_php: '50.00', status: 'CREATED', paypal_order_id: null, paypal_capture_id: null, fee_php: null, net_amount_php: null, created_at: '2026-11-12T00:00:00Z', completed_at: null }
const order: PayPalOrder = { id: orderId, reference: id, intent: 'CAPTURE', status: 'APPROVED', amount: '50.00', currency: 'PHP', approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`, captures: [] }
const captured: PayPalOrder = { ...order, status: 'COMPLETED', approvalUrl: null, captures: [{ id: '3C679366HH908993F', status: 'COMPLETED', final: true, amount: '50.00', currency: 'PHP', gross: '50.00', grossCurrency: 'PHP', fee: '16.70', feeCurrency: 'PHP', net: '33.30', netCurrency: 'PHP' }] }
let stored: FundTopupRow
let repository: ReturnType<typeof fakeRepository>
let gateway: { createOrder: ReturnType<typeof vi.fn>; getOrder: ReturnType<typeof vi.fn>; captureOrder: ReturnType<typeof vi.fn> }
const env = { PAYPAL_CLIENT_ID: 'client', PAYPAL_CLIENT_SECRET: 'private-secret', PAYPAL_PROGRAM_PAYER_EMAIL: 'test@example.com', CORS_ORIGIN: 'http://localhost:3000' }
function fakeRepository() {
  return { begin: vi.fn(), get: vi.fn(async () => stored), byOrder: vi.fn(async () => stored), saveOrder: vi.fn(async (_id: string, orderId: string) => { stored.paypal_order_id = orderId }),
    recordCapture: vi.fn(async (_id: string, _orderId: string, capture: PayPalOrderCapture) => { stored = { ...stored, status: 'COMPLETED', paypal_capture_id: capture.id, fee_php: capture.fee, net_amount_php: capture.net, completed_at: '2026-11-12T00:01:00Z' } }),
    ledger: vi.fn(async () => ({ summary: { gross_contributions_php: '50.00', fees_php: '16.70', net_contributions_php: '33.30', grants_issued_php: '100.00', grant_count: 1, confirmed_sales_php: '75.00', paid_invoices_php: '50.00', owed_php: '25.00', backed_grants_php: '0.00', available_to_grant_php: '33.30' }, topups: [stored] })) }
}
function service(overrides: Partial<typeof env> = {}) {
  return new FundService({} as SupabaseClient<Database>, { repository: repository as unknown as FundRepository, gateway: gateway as unknown as PayPalGateway, env: { ...env, ...overrides } })
}
beforeEach(() => {
  stored = { ...initial }; repository = fakeRepository()
  gateway = { createOrder: vi.fn().mockResolvedValue(ok(orderId)), getOrder: vi.fn().mockResolvedValue(ok({ ...order, status: 'PAYER_ACTION_REQUIRED' })), captureOrder: vi.fn().mockResolvedValue(ok(captured)) }
})
describe('Sandbox fund service', () => {
  it('creates once, fixes the amount, and resumes the same order on retry', async () => {
    const fund = service()
    expect(await fund.create({ requestId: id, amountPhp: '50.00' })).toMatchObject({ value: { topup: { paypal_order_id: orderId }, approvalUrl: order.approvalUrl } })
    expect(await fund.create({ requestId: id, amountPhp: '50.00' })).toMatchObject({ value: { topup: { paypal_order_id: orderId } } })
    expect(gateway.createOrder).toHaveBeenCalledTimes(1)
    expect(repository.begin).toHaveBeenCalledWith(id, '50.00')
    expect(gateway.createOrder).toHaveBeenCalledWith(id, '50.00', 'http://localhost:3000')
  })
  it('captures an approved matching order and returns the same receipt on retry', async () => {
    stored.paypal_order_id = orderId; gateway.getOrder.mockResolvedValue(ok(order))
    const fund = service()
    expect(await fund.capture(orderId)).toMatchObject({ value: { topup: { status: 'COMPLETED', fee_php: '16.70', net_amount_php: '33.30' } } })
    expect(await fund.capture(orderId)).toMatchObject({ value: { topup: { status: 'COMPLETED' } } })
    expect(gateway.captureOrder).toHaveBeenCalledTimes(1)
    expect(repository.recordCapture).toHaveBeenCalledTimes(1)
  })
  it('recovers a completed capture after a lost response without capturing again', async () => {
    stored.paypal_order_id = orderId; gateway.getOrder.mockResolvedValue(ok(captured))
    expect(await service().capture(orderId)).toMatchObject({ value: { topup: { status: 'COMPLETED' } } })
    expect(gateway.captureOrder).not.toHaveBeenCalled()
  })
  it.each([{ intent: 'AUTHORIZE' }, { reference: 'other' }, { currency: 'USD' }, { amount: '51.00' }, { id: '8O190127TN364715T' }, { status: 'CREATED' }])('rejects order proof %o before capture', async change => {
    stored.paypal_order_id = orderId; gateway.getOrder.mockResolvedValue(ok({ ...order, ...change }))
    expect((await service().capture(orderId)).isErr()).toBe(true)
    expect(gateway.captureOrder).not.toHaveBeenCalled(); expect(repository.recordCapture).not.toHaveBeenCalled()
  })
  it.each([
    { status: 'PENDING' }, { final: false }, { currency: 'USD' }, { grossCurrency: 'USD' },
    { feeCurrency: 'USD' }, { netCurrency: 'USD' }, { amount: '49.00' }, { gross: '49.00' }, { fee: null }, { net: null },
  ])('rejects incomplete capture proof %o', async change => {
    stored.paypal_order_id = orderId
    gateway.getOrder.mockResolvedValue(ok({ ...captured, captures: [{ ...captured.captures[0], ...change }] }))
    expect((await service().capture(orderId)).isErr()).toBe(true)
    expect(repository.recordCapture).not.toHaveBeenCalled()
  })
  it.each([[], [captured.captures[0], captured.captures[0]]])('rejects missing or multiple captures', async captures => {
    stored.paypal_order_id = orderId; gateway.getOrder.mockResolvedValue(ok({ ...captured, captures }))
    expect((await service().capture(orderId)).isErr()).toBe(true)
    expect(repository.recordCapture).not.toHaveBeenCalled()
  })
  it('rechecks proof after capture and keeps the contribution open on mismatch', async () => {
    stored.paypal_order_id = orderId; gateway.getOrder.mockResolvedValue(ok(order)); gateway.captureOrder.mockResolvedValue(ok({ ...captured, amount: '99.00' }))
    expect((await service().capture(orderId)).isErr()).toBe(true)
    expect(repository.recordCapture).not.toHaveBeenCalled()
  })
  it('does not expose unregistered order IDs', async () => {
    repository.byOrder.mockResolvedValue(null as unknown as FundTopupRow)
    expect(await service().capture(orderId)).toMatchObject({ error: { _tag: 'validation' } })
    expect(gateway.getOrder).not.toHaveBeenCalled()
  })
  it('uses the fixed sandbox loader and rejects untrusted return origins before writing', async () => {
    expect((await service({ CORS_ORIGIN: 'http://evil.test' }).create({ requestId: id, amountPhp: '50.00' })).isErr()).toBe(true)
    expect((await service({ PAYPAL_CLIENT_SECRET: '' }).create({ requestId: id, amountPhp: '50.00' })).isErr()).toBe(true)
    expect(repository.begin).not.toHaveBeenCalled()
  })
  it('returns safe expected errors from database and gateway failures', async () => {
    repository.begin.mockRejectedValueOnce({ code: '22023', message: 'private-secret' })
    expect(await service().create({ requestId: id, amountPhp: '51.00' })).toMatchObject({ error: { _tag: 'validation' } })
    gateway.createOrder.mockResolvedValueOnce(err(new PayPalError('Sandbox request failed.')))
    expect((await service().create({ requestId: id, amountPhp: '50.00' })).isErr()).toBe(true)
    stored.paypal_order_id = orderId; gateway.getOrder.mockResolvedValue(ok(order)); gateway.captureOrder.mockResolvedValue(err(new PayPalError('Sandbox request failed.')))
    expect((await service().capture(orderId)).isErr()).toBe(true)
    repository.ledger.mockRejectedValueOnce(new Error('private-secret'))
    const failed = await service().ledger(); expect(failed).toMatchObject({ error: { _tag: 'persistence' } }); expect(JSON.stringify(failed)).not.toContain('private-secret')
  })
  it('returns SQL-owned totals without recomputing them in the service', async () => {
    expect(await service().ledger()).toMatchObject({ value: { summary: { net_contributions_php: '33.30', owed_php: '25.00' } } })
  })
  it('keeps a capture recoverable when the database write fails after PayPal completes', async () => {
    stored.paypal_order_id = orderId; gateway.getOrder.mockResolvedValue(ok(order))
    repository.recordCapture.mockRejectedValueOnce(new Error('private-secret'))
    const fund = service()
    const interrupted = await fund.capture(orderId)
    expect(interrupted).toMatchObject({ error: { _tag: 'persistence' } })
    expect(JSON.stringify(interrupted)).not.toContain('private-secret')
    gateway.getOrder.mockResolvedValue(ok(captured))
    expect(await fund.capture(orderId)).toMatchObject({ value: { topup: { status: 'COMPLETED', paypal_capture_id: captured.captures[0].id } } })
    expect(gateway.captureOrder).toHaveBeenCalledTimes(1)
  })
  it('does not expose checkout when the local record cannot be read or the remote ID cannot be saved', async () => {
    repository.get.mockResolvedValueOnce(null as unknown as FundTopupRow)
    expect(await service().create({ requestId: id, amountPhp: '50.00' })).toMatchObject({ error: { _tag: 'persistence' } })
    expect(gateway.createOrder).not.toHaveBeenCalled()
    repository.saveOrder.mockRejectedValueOnce(new Error('private-secret'))
    expect(await service().create({ requestId: id, amountPhp: '50.00' })).toMatchObject({ error: { _tag: 'persistence' } })
  })
  it('keeps unknown capture outcomes safe on order-read and local-read failures', async () => {
    stored.paypal_order_id = orderId
    gateway.getOrder.mockResolvedValueOnce(err(new PayPalError('Sandbox read failed.')))
    expect(await service().capture(orderId)).toMatchObject({ error: { _tag: 'paypal' } })
    expect(gateway.captureOrder).not.toHaveBeenCalled()
    repository.byOrder.mockRejectedValueOnce(new Error('private-secret'))
    const result = await service().capture(orderId)
    expect(result).toMatchObject({ error: { _tag: 'persistence' } })
    expect(JSON.stringify(result)).not.toContain('private-secret')
  })
  it('rejects a mismatched create response and a missing approval URL without recording payment', async () => {
    gateway.getOrder.mockResolvedValueOnce(ok({ ...order, amount: '51.00' }))
    expect(await service().create({ requestId: id, amountPhp: '50.00' })).toMatchObject({ error: { _tag: 'paypal' } })
    gateway.getOrder.mockResolvedValueOnce(ok({ ...order, status: 'CREATED', approvalUrl: null }))
    expect(await service().create({ requestId: id, amountPhp: '50.00' })).toMatchObject({ error: { _tag: 'paypal' } })
    expect(repository.recordCapture).not.toHaveBeenCalled()
  })
})
