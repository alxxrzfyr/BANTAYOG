import { BaseRepository } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'

export class ProductRepository extends BaseRepository<'products'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'products')
  }

  // Performs fuzzy search (case-insensitive ILIKE) by product name in the catalog.
  async findByNameFuzzy(name: string) {
    const { data, error } = await this.db
      .from('products')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(5)

    if (error) throw error
    return data
  }

  // Exact-match lookup against the normalized SKU table.
  async findVariantByGtin(gtin: string) {
    const { data, error } = await (this.db as SupabaseClient)
      .from('product_variants')
      .select('*')
      .eq('gtin', gtin)
      .maybeSingle()

    // Keep the lookup compatible before migration 00016 reaches a deployment.
    if (error && !['PGRST205', '42P01'].includes(error.code ?? '')) throw error
    return error ? null : data
  }

  // Legacy fallback while old product rows are being migrated.
  async findByGtin(gtin: string) {
    const { data, error } = await this.db
      .from('products')
      .select('*')
      .eq('gtin', gtin)
      .maybeSingle()

    if (error) throw error
    return data
  }
}
