// BE1 owns this file. Requirements: PayPal settlement contract, sections 3 and 5.
import { BaseRepository, type Database, type SettlementSaleRow } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'

export class SettlementSaleRepository extends BaseRepository<'transactions'> {
  constructor(db: SupabaseClient<Database>) { super(db, 'transactions') }

  async findEligible(merchantId: string): Promise<SettlementSaleRow[]> {
    const { data, error } = await (this.db as SupabaseClient).from('settlement_eligible_sales')
      .select('*').eq('merchant_id', merchantId).order('sold_at').order('id').limit(100)
    if (error) throw error
    return (data ?? []) as SettlementSaleRow[]
  }

  async findReferencePrices(names: string[]): Promise<{ name: string; price_range_max: string | number }[]> {
    const { data, error } = await (this.db as SupabaseClient).from('products')
      .select('name, price_range_max').in('name', names)
    if (error) throw error
    return data ?? []
  }
}
