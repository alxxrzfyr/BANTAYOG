// BE1 owns this file. Requirements: PayPal fund contract.
import { BaseRepository, type Database, type FundTopupRow, type FundLedgerSummaryRow } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PayPalOrderCapture } from '../gateways/paypal.gateway.js'
import { z } from 'zod'

export type GrantReservation =
  | { outcome: 'acquired' }
  | { outcome: 'busy' }
  | { outcome: 'issued' }
  | { outcome: 'insufficient'; availablePhp: string }

const grantReservationSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('acquired') }),
  z.strictObject({ outcome: z.literal('busy') }),
  z.strictObject({ outcome: z.literal('issued') }),
  z.strictObject({ outcome: z.literal('insufficient'), availablePhp: z.string().regex(/^(0|[1-9]\d*)\.\d{2}(?![\s\S])/) }),
])

export class FundRepository extends BaseRepository<'fund_topups'> {
  constructor(db: SupabaseClient<Database>) { super(db, 'fund_topups') }

  async reserveGrant(beneficiaryId: string, attemptId: string, amountPhp: string): Promise<GrantReservation> {
    const { data, error } = await (this.db as SupabaseClient).rpc('reserve_grant_funding', {
      p_beneficiary_id: beneficiaryId, p_attempt_id: attemptId, p_amount_php: amountPhp,
    })
    if (error) throw error
    const parsed = grantReservationSchema.safeParse(data)
    if (!parsed.success) throw new Error('Invalid grant reservation response.')
    return parsed.data
  }

  async markGrantIssued(beneficiaryId: string, attemptId: string): Promise<boolean> {
    const { data, error } = await (this.db as SupabaseClient).rpc('mark_grant_funded', {
      p_beneficiary_id: beneficiaryId, p_attempt_id: attemptId,
    })
    if (error) throw error
    if (typeof data !== 'boolean') throw new Error('Invalid grant finalization response.')
    return data
  }

  async begin(id: string, amountPhp: string): Promise<void> {
    const { error } = await (this.db as SupabaseClient).rpc('create_fund_topup', { p_id: id, p_amount_php: amountPhp })
    if (error) throw error
  }

  async get(id: string): Promise<FundTopupRow | null> { return this.findDetail('id', id) }
  async byOrder(orderId: string): Promise<FundTopupRow | null> { return this.findDetail('paypal_order_id', orderId) }

  private async findDetail(column: 'id' | 'paypal_order_id', value: string): Promise<FundTopupRow | null> {
    const { data, error } = await (this.db as SupabaseClient).from('fund_topup_details').select('*').eq(column, value).maybeSingle()
    if (error) throw error
    return data as FundTopupRow | null
  }

  async saveOrder(id: string, orderId: string): Promise<void> {
    const { error } = await (this.db as SupabaseClient).from('fund_topups').update({ paypal_order_id: orderId })
      .eq('id', id).eq('status', 'CREATED').is('paypal_order_id', null)
    if (error) throw error
  }

  async recordCapture(id: string, orderId: string, capture: PayPalOrderCapture): Promise<void> {
    const { error } = await (this.db as SupabaseClient).rpc('record_fund_capture', {
      p_id: id, p_order_id: orderId, p_capture_id: capture.id,
      p_amount_php: capture.amount, p_fee_php: capture.fee, p_net_amount_php: capture.net,
    })
    if (error) throw error
  }

  async ledger(): Promise<{ summary: FundLedgerSummaryRow; topups: FundTopupRow[] }> {
    const { data: summary, error } = await (this.db as SupabaseClient).from('fund_ledger_summary').select('*').single()
    if (error) throw error
    const { data: topups, error: listError } = await (this.db as SupabaseClient).from('fund_topup_details').select('*')
      .eq('status', 'COMPLETED').order('completed_at', { ascending: false }).order('id').limit(50)
    if (listError) throw listError
    return { summary: summary as FundLedgerSummaryRow, topups: (topups ?? []) as FundTopupRow[] }
  }
}
