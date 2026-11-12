// BE1 owns this file. Requirements: PayPal settlement contract, section 4.
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { PayPalConfig } from '../lib/paypal/config.js'
import { type AppResult, PayPalError, ok, err } from '../lib/errors.js'
import { collectConfiguredSecrets, redactSecrets } from '../lib/redact.js'

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() })
const invoiceSchema = z.object({
  id: z.string().regex(/^INV2-[A-Z0-9-]+$/i), status: z.string().min(1),
  detail: z.object({ reference: z.string(), metadata: z.object({ recipient_view_url: z.string().optional() }).optional() }),
  amount: z.object({ currency_code: z.string(), value: z.string().regex(/^\d+\.\d{2}$/) }),
})

const orderMoney = z.object({ currency_code: z.string(), value: z.string().regex(/^\d+\.\d{2}$/) })
const orderSchema = z.object({
  id: z.string().regex(/^[A-Z0-9]{17}$/), status: z.string(), intent: z.string(),
  purchase_units: z.array(z.object({
    reference_id: z.string(), amount: orderMoney,
    payments: z.object({ captures: z.array(z.object({
      id: z.string().regex(/^[A-Z0-9]{17}$/), status: z.string(), final_capture: z.boolean(), amount: orderMoney,
      seller_receivable_breakdown: z.object({ gross_amount: orderMoney, paypal_fee: orderMoney, net_amount: orderMoney }).optional(),
    })).default([]) }).optional(),
  })).length(1),
  links: z.array(z.object({ rel: z.string(), href: z.string() })).default([]),
})

export interface PayPalOrderCapture {
  id: string; status: string; final: boolean; amount: string; currency: string
  gross: string | null; grossCurrency: string | null; fee: string | null; feeCurrency: string | null
  net: string | null; netCurrency: string | null
}
export interface PayPalOrder {
  id: string; status: string; intent: string; reference: string; amount: string; currency: string
  approvalUrl: string | null; captures: PayPalOrderCapture[]
}

export interface PayPalInvoice {
  id: string
  status: string
  reference: string
  currency: string
  amount: string
  payUrl: string | null
}

export interface PayPalSale {
  transactionId: string
  amountPhp: string
  soldAt: string
  itemNames: string[]
}

export class PayPalGateway {
  private token: { value: string; refreshAt: number } | undefined
  private tokenRequest: Promise<AppResult<string>> | undefined

  constructor(
    private readonly config: PayPalConfig,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getToken(_settlementId: string): Promise<AppResult<string>> {
    if (this.token && this.now() < this.token.refreshAt) return ok(this.token.value)
    if (this.tokenRequest) return this.tokenRequest
    this.tokenRequest = this.requestToken()
    try { return await this.tokenRequest } finally { this.tokenRequest = undefined }
  }

  private async requestToken(): Promise<AppResult<string>> {
    try {
      const response = await this.fetcher(`${this.config.apiBase}/v1/oauth2/token`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        }, body: 'grant_type=client_credentials',
      })
      if (!response.ok) return this.failure('token', response.status)
      const parsed = tokenSchema.safeParse(await response.json())
      if (!parsed.success) return this.failure('token response')
      this.token = { value: parsed.data.access_token, refreshAt: this.now() + Math.max(0, parsed.data.expires_in - 60) * 1000 }
      return ok(this.token.value)
    } catch { return this.failure('token connection') }
  }

  async createDraft(settlementId: string, sales: PayPalSale[]): Promise<AppResult<string>> {
    // shortcut: One sandbox business account invoices for all stores. Add store onboarding before production use.
    const result = await this.request(settlementId, '/v2/invoicing/invoices', 'POST', 'c', {
      detail: {
        reference: settlementId, currency_code: 'PHP',
        // The fixed number also prevents a second draft after a request key expires.
        invoice_number: `BT-${createHash('sha256').update(settlementId).digest('hex').slice(0, 22)}`,
        payment_term: { term_type: 'DUE_ON_RECEIPT' },
      },
      primary_recipients: [{ billing_info: { email_address: this.config.payerEmail } }],
      configuration: { partial_payment: { allow_partial_payment: false }, allow_tip: false },
      items: sales.map(sale => ({
        name: `Sale ${sale.transactionId.slice(0, 8)}`, quantity: '1',
        description: `${sale.itemNames.join(', ')}; ${sale.soldAt}`.slice(0, 1000),
        unit_amount: { currency_code: 'PHP', value: sale.amountPhp },
      })),
    })
    if (result.isErr()) return err(result.error)
    const body = result.value as { id?: unknown; href?: unknown }
    let id = typeof body?.id === 'string' ? body.id : ''
    if (!id && typeof body?.href === 'string') {
      try {
        const link = new URL(body.href)
        if (['https://api-m.sandbox.paypal.com', 'https://api.sandbox.paypal.com'].includes(link.origin) && !link.username && !link.password && !link.search && !link.hash &&
            /^\/v2\/invoicing\/invoices\/INV2-[A-Z0-9-]+$/i.test(link.pathname)) id = link.pathname.split('/').at(-1) ?? ''
      } catch { return this.failure('draft response') }
    }
    return /^INV2-[A-Z0-9-]+$/i.test(id) ? ok(id) : this.failure('draft response')
  }

  async send(settlementId: string, invoiceId: string): Promise<AppResult<void>> {
    const result = await this.request(settlementId, `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, 'POST', 's', { send_to_recipient: true, send_to_invoicer: false })
    return result.isErr() ? err(result.error) : ok(undefined)
  }

  async createOrder(id: string, amountPhp: string, returnOrigin: string): Promise<AppResult<string>> {
    const result = await this.request(id, '/v2/checkout/orders', 'POST', 'oc', {
      intent: 'CAPTURE', purchase_units: [{ reference_id: id, invoice_id: `BT-FUND-${id}`,
        description: 'BANTAYOG sandbox nutrition contribution', amount: { currency_code: 'PHP', value: amountPhp } }],
      payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW',
        return_url: `${returnOrigin}/fund?result=approved`, cancel_url: `${returnOrigin}/fund?result=cancelled` } } },
    })
    if (result.isErr()) return err(result.error)
    const parsed = z.object({ id: z.string().regex(/^[A-Z0-9]{17}$/) }).safeParse(result.value)
    return parsed.success ? ok(parsed.data.id) : this.failure('order response')
  }

  async getOrder(id: string, orderId: string): Promise<AppResult<PayPalOrder>> {
    const result = await this.request(id, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'GET')
    if (result.isErr()) return err(result.error)
    const parsed = orderSchema.safeParse(result.value)
    if (!parsed.success) return this.failure('order proof')
    const order = parsed.data
    const unit = order.purchase_units[0]
    const approvalUrl = order.links.find(link => link.rel === 'approve' || link.rel === 'payer-action')?.href ?? null
    if (approvalUrl) {
      try {
        const url = new URL(approvalUrl)
        if (url.origin !== 'https://www.sandbox.paypal.com' || url.username || url.password ||
          !/^\/checkoutnow\/?$/.test(url.pathname) || url.searchParams.get('token') !== order.id || url.hash) return this.failure('order approval URL')
      } catch { return this.failure('order approval URL') }
    }
    return ok({ id: order.id, status: order.status, intent: order.intent, reference: unit.reference_id,
      amount: unit.amount.value, currency: unit.amount.currency_code, approvalUrl,
      captures: (unit.payments?.captures ?? []).map(capture => {
        const amounts = capture.seller_receivable_breakdown
        return { id: capture.id, status: capture.status, final: capture.final_capture,
          amount: capture.amount.value, currency: capture.amount.currency_code,
          gross: amounts?.gross_amount.value ?? null, grossCurrency: amounts?.gross_amount.currency_code ?? null,
          fee: amounts?.paypal_fee.value ?? null, feeCurrency: amounts?.paypal_fee.currency_code ?? null,
          net: amounts?.net_amount.value ?? null, netCurrency: amounts?.net_amount.currency_code ?? null }
      }),
    })
  }

  async captureOrder(id: string, orderId: string): Promise<AppResult<PayPalOrder>> {
    const result = await this.request(id, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'POST', 'op', {})
    // Read the full order. Capture responses can omit intent and the purchase-unit amount.
    return result.isErr() ? err(result.error) : this.getOrder(id, orderId)
  }

  async get(settlementId: string, invoiceId: string): Promise<AppResult<PayPalInvoice>> {
    const result = await this.request(settlementId, `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, 'GET')
    if (result.isErr()) return err(result.error)
    const parsed = invoiceSchema.safeParse(result.value)
    if (!parsed.success) return this.failure('invoice response')
    const invoice = parsed.data
    const payUrl = invoice.detail.metadata?.recipient_view_url ?? null
    if (payUrl) {
      try {
        const url = new URL(payUrl)
        if (url.protocol !== 'https:' || url.hostname !== 'www.sandbox.paypal.com' || url.username || url.password || url.port) return this.failure('payer URL')
      } catch { return this.failure('payer URL') }
    }
    return ok({ id: invoice.id, status: invoice.status, reference: invoice.detail.reference, currency: invoice.amount.currency_code, amount: invoice.amount.value, payUrl })
  }

  private async request(settlementId: string, path: string, method: 'GET' | 'POST', operation?: string, body?: unknown): Promise<AppResult<unknown>> {
    const token = await this.getToken(settlementId)
    if (token.isErr()) return token
    try {
      const response = await this.fetcher(`${this.config.apiBase}${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json',
          ...(['c', 'oc', 'op'].includes(operation ?? '') ? { Prefer: 'return=representation' } : {}),
          ...(operation ? { 'PayPal-Request-Id': this.key(settlementId, operation) } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.ok) {
        if (response.status === 401) this.token = undefined
        return this.failure('invoice request', response.status)
      }
      if (method === 'POST' && operation === 's') return ok(undefined)
      return ok(redactSecrets(await response.json(), collectConfiguredSecrets(this.config, token.value)))
    } catch { return this.failure('invoice connection') }
  }

  private key(id: string, operation: string): string { return `${id.replaceAll('-', '')}-${operation}` }

  private failure(operation: string, status?: number): AppResult<never> {
    return err(new PayPalError(`PayPal ${operation} failed${status ? ` (HTTP ${status})` : ''}. Retry the same settlement.`))
  }
}

let shared: { config: PayPalConfig; gateway: PayPalGateway } | undefined
export function getPayPalGateway(config: PayPalConfig): PayPalGateway {
  if (!shared || JSON.stringify(shared.config) !== JSON.stringify(config)) shared = { config, gateway: new PayPalGateway(config) }
  return shared.gateway
}
