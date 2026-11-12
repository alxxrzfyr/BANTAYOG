// BE1 owns this file. Requirements: PayPal settlement contract, sections 3 and 6.
import { BaseRepository, type Database, type SettlementInvoiceSummaryRow, type SettlementLineDetailRow, type SettlementMerchantOverviewRow, type SettlementInvoiceStatus } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SettlementReview } from '../domain/settlement.js'

export type SettlementDetail = SettlementInvoiceSummaryRow & { lines: SettlementLineDetailRow[] }

export class SettlementRepository extends BaseRepository<'settlement_invoices'> {
  constructor(db: SupabaseClient<Database>) { super(db, 'settlement_invoices') }

  async findActive(merchantId: string): Promise<SettlementInvoiceSummaryRow | null> {
    const { data, error } = await (this.db as SupabaseClient).from('settlement_invoice_summaries')
      .select('*').eq('merchant_id', merchantId).in('status', ['PROPOSED', 'SENT']).maybeSingle()
    if (error) throw error
    return data as SettlementInvoiceSummaryRow | null
  }

  async getDetail(id: string): Promise<SettlementDetail | null> {
    const { data, error } = await (this.db as SupabaseClient).from('settlement_invoice_summaries')
      .select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return null
    const { data: lines, error: lineError } = await (this.db as SupabaseClient).from('settlement_line_details')
      .select('*').eq('invoice_id', id).order('sold_at').order('transaction_id')
    if (lineError) throw lineError
    return { ...(data as SettlementInvoiceSummaryRow), lines: (lines ?? []) as SettlementLineDetailRow[] }
  }

  async list(filters: { merchantId?: string; status?: SettlementInvoiceStatus }): Promise<SettlementInvoiceSummaryRow[]> {
    const rows: SettlementInvoiceSummaryRow[] = []
    for (let from = 0; ; from += 1000) {
      let query = (this.db as SupabaseClient).from('settlement_invoice_summaries').select('*')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + 999)
      if (filters.merchantId) query = query.eq('merchant_id', filters.merchantId)
      if (filters.status) query = query.eq('status', filters.status)
      const { data, error } = await query
      if (error) throw error
      rows.push(...(data ?? []) as SettlementInvoiceSummaryRow[])
      if (!data || data.length < 1000) return rows
    }
  }

  async overview(merchantId: string): Promise<SettlementMerchantOverviewRow> {
    const { data, error } = await (this.db as SupabaseClient).from('settlement_merchant_overviews')
      .select('*').eq('merchant_id', merchantId).single()
    if (error) throw error
    return data as SettlementMerchantOverviewRow
  }

  async findMerchantForUser(userId: string): Promise<{ id: string; status: string } | null> {
    const { data, error } = await (this.db as SupabaseClient).from('merchants')
      .select('id, status').eq('auth_user_id', userId).maybeSingle()
    if (error) throw error
    return data
  }

  async createProposal(merchantId: string, review: SettlementReview, saleIds: string[]): Promise<{ id: string; created: boolean }> {
    const { data, error } = await (this.db as SupabaseClient).rpc('create_settlement_proposal', {
      p_merchant_id: merchantId, p_held: review.held, p_ai_summary: review.aiSummary, p_sale_ids: saleIds,
    })
    if (error) throw error
    return data as { id: string; created: boolean }
  }

  async approve(id: string, adminId: string, release: string[]): Promise<string> {
    const { data, error } = await (this.db as SupabaseClient).rpc('approve_settlement', { p_invoice_id: id, p_admin_id: adminId, p_release: release })
    if (error) throw error
    return data as string
  }

  async cancel(id: string, reason: string): Promise<string> {
    const { data, error } = await (this.db as SupabaseClient).rpc('cancel_settlement', { p_invoice_id: id, p_reason: reason })
    if (error) throw error
    return data as string
  }

  async saveDraft(id: string, paypalId: string): Promise<void> {
    const { error } = await (this.db as SupabaseClient).from('settlement_invoices').update({ paypal_invoice_id: paypalId })
      .eq('id', id).eq('status', 'PROPOSED').is('paypal_invoice_id', null)
    if (error) throw error
  }

  async markSent(id: string, paypalId: string, sentAt: string, payUrl: string | null): Promise<void> {
    const { error } = await (this.db as SupabaseClient).from('settlement_invoices')
      .update({ status: 'SENT', sent_at: sentAt, paypal_invoice_url: payUrl })
      .eq('id', id).eq('paypal_invoice_id', paypalId).eq('status', 'PROPOSED')
    if (error) throw error
    if (payUrl !== null) {
      const { error: backfillError } = await (this.db as SupabaseClient).from('settlement_invoices')
        .update({ paypal_invoice_url: payUrl })
        .eq('id', id).eq('paypal_invoice_id', paypalId).eq('status', 'SENT').is('paypal_invoice_url', null)
      if (backfillError) throw backfillError
    }
  }

  async markPaid(id: string, paypalId: string, paidAt: string, payUrl: string | null): Promise<void> {
    const { error } = await (this.db as SupabaseClient).from('settlement_invoices')
      .update({ status: 'PAID', paid_at: paidAt, ...(payUrl === null ? {} : { paypal_invoice_url: payUrl }) })
      .eq('id', id).eq('paypal_invoice_id', paypalId).eq('status', 'SENT')
    if (error) throw error
  }
}
