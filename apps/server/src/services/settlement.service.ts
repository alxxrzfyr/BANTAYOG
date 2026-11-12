// BE1 owns this file. Requirements: PayPal settlement contract, sections 3-6.
import type { Database, SettlementInvoiceSummaryRow, SettlementMerchantOverviewRow } from '@bantayog/db'
import type { SettlementStatus } from '@bantayog/schema'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SettlementRepository, type SettlementDetail } from '../repositories/settlement.repository.js'
import { SettlementSaleRepository } from '../repositories/settlement-sale.repository.js'
import { SettlementProposalService } from './settlement-proposal.service.js'
import { getPayPalGateway, type PayPalGateway, type PayPalInvoice } from '../gateways/paypal.gateway.js'
import { loadPayPalConfig } from '../lib/paypal/config.js'
import { toSettlementLineDTO } from '../dto/mappers.js'
import { type AppResult, AuthError, PayPalError, PersistenceError, ValidationError, ok, err } from '../lib/errors.js'

export class SettlementService {
  private readonly repository: SettlementRepository
  private readonly sales: SettlementSaleRepository
  private readonly proposal: SettlementProposalService

  constructor(db: SupabaseClient<Database>, private readonly options: {
    repository?: SettlementRepository
    sales?: SettlementSaleRepository
    proposal?: SettlementProposalService
    gateway?: PayPalGateway
    env?: Partial<Record<string, string | undefined>>
    currentDate?: Date
  } = {}) {
    this.repository = options.repository ?? new SettlementRepository(db)
    this.sales = options.sales ?? new SettlementSaleRepository(db)
    this.proposal = options.proposal ?? new SettlementProposalService(this.sales)
  }

  async merchantForUser(userId: string): Promise<AppResult<string>> {
    try {
      const merchant = await this.repository.findMerchantForUser(userId)
      if (!merchant || merchant.status !== 'APPROVED') return err(new AuthError('An approved merchant profile is required.'))
      return ok(merchant.id)
    } catch (error) { return this.failure(error) }
  }

  async propose(merchantId: string): Promise<AppResult<{ invoice: SettlementDetail; created: boolean }>> {
    try {
      const active = await this.repository.findActive(merchantId)
      if (active) {
        const invoice = await this.get(active.id, merchantId)
        return invoice.isErr() ? err(invoice.error) : ok({ invoice: invoice.value, created: false })
      }
      const sales = await this.sales.findEligible(merchantId)
      if (!sales.length) {
        const concurrent = await this.repository.findActive(merchantId)
        if (concurrent) {
          const invoice = await this.get(concurrent.id, merchantId)
          return invoice.isErr() ? err(invoice.error) : ok({ invoice: invoice.value, created: false })
        }
        return err(new ValidationError('There are no eligible unpaid sales. Sales may still wait for ledger confirmation.'))
      }
      const review = await this.proposal.review(sales)
      if (review.isErr()) return err(review.error)
      const result = await this.repository.createProposal(merchantId, review.value, sales.map(sale => sale.id))
      const invoice = await this.get(result.id, merchantId)
      return invoice.isErr() ? err(invoice.error) : ok({ invoice: invoice.value, created: result.created })
    } catch (error) { return this.failure(error) }
  }

  async get(id: string, merchantId?: string): Promise<AppResult<SettlementDetail>> {
    try {
      const invoice = await this.repository.getDetail(id)
      if (!invoice) return err(new ValidationError('Settlement invoice not found.'))
      if (merchantId && invoice.merchant_id !== merchantId) return err(new AuthError('You cannot access this settlement invoice.'))
      return ok(invoice)
    } catch (error) { return this.failure(error) }
  }

  async list(status?: SettlementStatus): Promise<AppResult<SettlementInvoiceSummaryRow[]>> {
    try { return ok(await this.repository.list({ status })) } catch (error) { return this.failure(error) }
  }

  async overview(merchantId: string): Promise<AppResult<SettlementMerchantOverviewRow & { invoices: SettlementInvoiceSummaryRow[] }>> {
    try {
      const overview = await this.repository.overview(merchantId)
      const invoices = await this.repository.list({ merchantId })
      return ok({ ...overview, invoices })
    } catch (error) { return this.failure(error) }
  }

  async approve(id: string, adminId: string, releaseTransactionIds: string[] = []): Promise<AppResult<SettlementDetail>> {
    const current = await this.get(id)
    if (current.isErr()) return current
    if (current.value.status === 'PAID') return current
    if (current.value.status === 'SENT') return current.value.paypal_invoice_url ? current : this.refresh(id)
    if (current.value.status === 'CANCELLED') return err(new ValidationError('A cancelled invoice cannot be approved.'))
    if (releaseTransactionIds.some(saleId => !current.value.lines.some(line => line.transaction_id === saleId))) {
      return err(new ValidationError('Release only sales on this invoice.'))
    }
    if (current.value.lines.every(line => line.held) && releaseTransactionIds.length === 0) {
      return err(new ValidationError('Release at least one held sale before approval, or reject the proposal.'))
    }
    const gateway = this.gateway()
    if (gateway.isErr()) return err(gateway.error)
    try {
      await this.repository.approve(id, adminId, releaseTransactionIds)
      const approved = await this.get(id)
      if (approved.isErr()) return approved
      let paypalId = approved.value.paypal_invoice_id
      if (!paypalId) {
        const sales = approved.value.lines.filter(line => !line.held).map(line => {
          const dto = toSettlementLineDTO(line)
          return { transactionId: dto.transactionId, amountPhp: dto.amountPhp, soldAt: dto.soldAt, itemNames: dto.items.map(item => item.name) }
        })
        const draft = await gateway.value.createDraft(id, sales)
        if (draft.isErr()) return err(draft.error)
        paypalId = draft.value
        await this.repository.saveDraft(id, paypalId)
        const saved = await this.get(id)
        if (saved.isErr()) return saved
        if (saved.value.paypal_invoice_id !== paypalId) return err(new PayPalError('PayPal draft does not match the saved invoice. Review this settlement.'))
      }
      const proof = await gateway.value.get(id, paypalId)
      if (proof.isErr()) return err(proof.error)
      if (!this.matches({ ...approved.value, paypal_invoice_id: paypalId }, proof.value) ||
          ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'MARKED_AS_REFUNDED'].includes(proof.value.status)) {
        return err(new PayPalError('PayPal draft proof does not match an invoice that can be sent. Review this settlement.'))
      }
      if (proof.value.status === 'DRAFT') {
        const sent = await gateway.value.send(id, paypalId)
        if (sent.isErr()) return err(sent.error)
      }
      const synced = await this.sync(approved.value, gateway.value)
      if (synced.isOk() && synced.value.status !== 'PAID' && (synced.value.status === 'PROPOSED' || !synced.value.paypal_invoice_url)) {
        return err(new PayPalError('PayPal has not yet returned a sent invoice with a payer link. Retry approval.'))
      }
      return synced
    } catch (error) { return this.failure(error) }
  }

  async reject(id: string, reason: string): Promise<AppResult<SettlementDetail>> {
    if (!reason.trim()) return err(new ValidationError('A rejection reason is required.'))
    const invoice = await this.get(id)
    if (invoice.isErr()) return invoice
    if (invoice.value.status === 'CANCELLED') return invoice
    if (invoice.value.status !== 'PROPOSED' || invoice.value.approved_by) {
      return err(new ValidationError('An approved or sent invoice cannot be rejected. Retry approval or refresh its status.'))
    }
    try {
      await this.repository.cancel(id, reason)
      return this.get(id)
    } catch (error) { return this.failure(error) }
  }

  async refresh(id: string, merchantId?: string): Promise<AppResult<SettlementDetail>> {
    const invoice = await this.get(id, merchantId)
    if (invoice.isErr()) return invoice
    if (!invoice.value.paypal_invoice_id || invoice.value.status === 'PAID' || invoice.value.status === 'CANCELLED') return invoice
    const gateway = this.gateway()
    return gateway.isErr() ? err(gateway.error) : this.sync(invoice.value, gateway.value)
  }

  private async sync(invoice: SettlementDetail, gateway: PayPalGateway): Promise<AppResult<SettlementDetail>> {
    try {
      // Reload the saved draft id. Another approval request may have saved it.
      const current = await this.get(invoice.id)
      if (current.isErr()) return current
      const paypalId = current.value.paypal_invoice_id
      if (!paypalId) return err(new PayPalError('PayPal draft id is missing. Retry approval.'))
      const remote = await gateway.get(invoice.id, paypalId)
      if (remote.isErr()) return err(remote.error)
      if (!this.matches(current.value, remote.value)) return err(new PayPalError('PayPal invoice proof does not match this settlement. Review this settlement.'))
      const date = (this.options.currentDate ?? new Date()).toISOString()
      if (['SENT', 'UNPAID', 'PAYMENT_PENDING', 'PARTIALLY_PAID', 'MARKED_AS_PAID', 'PAID'].includes(remote.value.status)) {
        await this.repository.markSent(invoice.id, paypalId, date, remote.value.payUrl)
      }
      // MARKED_AS_PAID is an external/manual payment, not a confirmed PayPal payment.
      if (remote.value.status === 'PAID') await this.repository.markPaid(invoice.id, paypalId, date, remote.value.payUrl)
      return this.get(invoice.id)
    } catch (error) { return this.failure(error) }
  }

  private matches(invoice: SettlementDetail, remote: PayPalInvoice): boolean {
    return remote.id === invoice.paypal_invoice_id && remote.reference === invoice.id &&
      remote.currency === 'PHP' && remote.amount === invoice.total_amount_php
  }

  private gateway(): AppResult<PayPalGateway> {
    const config = loadPayPalConfig(this.options.env ?? process.env)
    return config.isErr() ? err(config.error) : ok(this.options.gateway ?? getPayPalGateway(config.value))
  }

  private failure(error: unknown): AppResult<never> {
    const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (code === '22023' || code === '23505') return err(new ValidationError('Settlement state changed. Reload the invoice and retry the same action.'))
    return err(new PersistenceError('Unable to read or save the settlement. Retry the same action.', 'settlement_invoices'))
  }
}
