import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'
import { ProductRepository } from '../repositories/product.repository.js'
import { type AppResult, ok, err, PersistenceError } from '../lib/errors.js'

export interface ValidationSuccessResult {
  matched: true
  product: {
    id: string
    name: string
    eligibility_status: 'eligible' | 'ineligible'
    category: string
  }
}

export interface ValidationFailureResult {
  matched: false
  reason: string
}

export type ValidationResult = ValidationSuccessResult | ValidationFailureResult

export class ProductsService {
  private productRepo: ProductRepository

  constructor(db: SupabaseClient<Database>) {
    this.productRepo = new ProductRepository(db)
  }

  /**
   * Validates a product name against the catalog.
   * Performs case-insensitive matches using fuzzy/ILIKE query logic.
   */
  async validateProduct(name: string): Promise<AppResult<ValidationResult>> {
    if (!name || name.trim() === '') {
      return ok({ matched: false, reason: 'Empty product name provided' })
    }

    try {
      const results = await this.productRepo.findByNameFuzzy(name.trim())

      if (!results || results.length === 0) {
        return ok({ matched: false, reason: 'Product not found in catalog' })
      }

      // Find the best/first match from the list
      const matched = results[0] as any
      return ok({
        matched: true,
        product: {
          id: matched.id,
          name: matched.name,
          eligibility_status: matched.eligibility_status,
          category: matched.category
        }
      })
    } catch (error: any) {
      return err(new PersistenceError(`Database lookup failed: ${error.message}`, 'products'))
    }
  }
}

