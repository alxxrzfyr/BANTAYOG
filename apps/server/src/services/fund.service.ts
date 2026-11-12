// BE1 owns this file. Requirements: PayPal fund contract.
import type { Database, FundTopupRow } from '@bantayog/db'
import type { CreateFundTopupDto } from '@bantayog/schema'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FundRepository } from '../repositories/fund.repository.js'
import { getPayPalGateway, type PayPalGateway, type PayPalOrder } from '../gateways/paypal.gateway.js'
import { loadPayPalConfig } from '../lib/paypal/config.js'
import { type AppResult, PayPalError, PersistenceError, ValidationError, ok, err } from '../lib/errors.js'

export interface FundResult { topup: FundTopupRow; approvalUrl: string | null }

export class FundService {
  private readonly repository: FundRepository
  private readonly env: Partial<Record<string, string | undefined>>
  constructor(db: SupabaseClient<Database>, private readonly options: {
    repository?: FundRepository; gateway?: PayPalGateway; env?: Partial<Record<string, string | undefined>>
  } = {}) {
    this.repository = options.repository ?? new FundRepository(db)
    this.env = options.env ?? process.env
  }

  async create(input: CreateFundTopupDto): Promise<AppResult<FundResult>> {
    const gateway = this.gateway()
    if (gateway.isErr()) return err(gateway.error)
    const origin = this.returnOrigin()
    if (origin.isErr()) return err(origin.error)
    try {
      await this.repository.begin(input.requestId, input.amountPhp)
      let row = await this.repository.get(input.requestId)
      if (!row) return this.missingRecord()
      if (row.status === 'COMPLETED') return ok({ topup: row, approvalUrl: null })
      if (!row.paypal_order_id) {
        const created = await gateway.value.createOrder(row.id, row.amount_php, origin.value)
        if (created.isErr()) return err(created.error)
        await this.repository.saveOrder(row.id, created.value)
        row = await this.repository.get(row.id)
        if (!row || row.paypal_order_id !== created.value) return this.missingRecord()
      }
      const remote = await gateway.value.getOrder(row.id, row.paypal_order_id!)
      if (remote.isErr()) return err(remote.error)
      if (!this.matches(row, remote.value)) return this.badProof()
      if (remote.value.status === 'COMPLETED' || remote.value.status === 'APPROVED') return this.complete(row, remote.value, gateway.value)
      if (!['CREATED', 'PAYER_ACTION_REQUIRED'].includes(remote.value.status) || !remote.value.approvalUrl) return this.badProof()
      return ok({ topup: row, approvalUrl: remote.value.approvalUrl })
    } catch (error) { return this.failure(error) }
  }

  async capture(orderId: string): Promise<AppResult<FundResult>> {
    try {
      const row = await this.repository.byOrder(orderId)
      if (!row) return err(new ValidationError('Contribution not found.'))
      if (row.status === 'COMPLETED') return ok({ topup: row, approvalUrl: null })
      const gateway = this.gateway()
      if (gateway.isErr()) return err(gateway.error)
      const remote = await gateway.value.getOrder(row.id, orderId)
      return remote.isErr() ? err(remote.error) : this.complete(row, remote.value, gateway.value)
    } catch (error) { return this.failure(error) }
  }

  private async complete(row: FundTopupRow, order: PayPalOrder, gateway: PayPalGateway): Promise<AppResult<FundResult>> {
    if (!this.matches(row, order)) return this.badProof()
    try {
      if (order.status === 'APPROVED') {
        const captured = await gateway.captureOrder(row.id, order.id)
        if (captured.isErr()) return err(captured.error)
        order = captured.value
      }
      if (!this.matches(row, order) || order.status !== 'COMPLETED' || order.captures.length !== 1) return this.badProof()
      const capture = order.captures[0]
      if (capture.status !== 'COMPLETED' || !capture.final || capture.amount !== row.amount_php || capture.gross !== row.amount_php ||
        [capture.currency, capture.grossCurrency, capture.feeCurrency, capture.netCurrency].some(currency => currency !== 'PHP') ||
        capture.fee === null || capture.net === null) return this.badProof()
      // SQL validates gross = fee + net, locks the row and rejects a different capture.
      await this.repository.recordCapture(row.id, order.id, capture)
      const saved = await this.repository.get(row.id)
      return saved?.status === 'COMPLETED' ? ok({ topup: saved, approvalUrl: null }) : this.missingRecord()
    } catch (error) { return this.failure(error) }
  }

  async ledger(): Promise<AppResult<Awaited<ReturnType<FundRepository['ledger']>>>> {
    try { return ok(await this.repository.ledger()) } catch (error) { return this.failure(error) }
  }

  private matches(row: FundTopupRow, order: PayPalOrder): boolean {
    return order.id === row.paypal_order_id && order.intent === 'CAPTURE' && order.reference === row.id &&
      order.currency === 'PHP' && order.amount === row.amount_php
  }

  private gateway(): AppResult<PayPalGateway> {
    const config = loadPayPalConfig(this.env)
    return config.isErr() ? err(config.error) : ok(this.options.gateway ?? getPayPalGateway(config.value))
  }

  private returnOrigin(): AppResult<string> {
    try {
      const value = this.env.CORS_ORIGIN?.split(',')[0]?.trim() || (this.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '')
      const url = new URL(value)
      if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        !(url.protocol === 'https:' || (this.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
        return err(new ValidationError('Configure a valid CORS_ORIGIN for the fund return page.'))
      }
      return ok(url.origin)
    } catch { return err(new ValidationError('Configure a valid CORS_ORIGIN for the fund return page.')) }
  }

  private badProof(): AppResult<never> { return err(new PayPalError('PayPal has not returned matching, completed contribution proof. Check approval or retry the same contribution.')) }
  private missingRecord(): AppResult<never> { return err(new PersistenceError('Unable to save the contribution. Retry the same request.', 'fund_topups')) }
  private failure(error: unknown): AppResult<never> {
    const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined
    return code === '22023' || code === '23505'
      ? err(new ValidationError('The contribution request or capture proof conflicts with its saved record. Keep the same amount and retry, or ask the program officer to review it.'))
      : this.missingRecord()
  }
}
