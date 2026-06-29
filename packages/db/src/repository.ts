/**
 * Base repository class with typed query helpers.
 *
 * BE1 owns this file. All repositories (beneficiary.repo.ts, merchant.repo.ts, etc.)
 * extend this base class to get typed CRUD operations against Supabase.
 *
 * Per BANTAYOG_PROJECT_PLAN.md §6: repositories/ are Supabase-backed classes,
 * one per table, with typed interfaces. Routes depend on repo interfaces only.
 *
 * Implementation note: Supabase's generated client types use deeply nested
 * conditional types that don't compose cleanly with a generic `BaseRepository<T>`.
 * We use an untyped query builder internally (via `as never`) and restore type
 * safety at the return boundary with `as RowType<T>`. The Database type in
 * types.ts guarantees column names and row shapes match, making these casts safe.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TableName } from './types.js'

// ---------------------------------------------------------------------------
// Helper: extract row/insert/update types from table name
// ---------------------------------------------------------------------------

export type RowType<T extends TableName> = Database['public']['Tables'][T]['Row']
export type InsertType<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type UpdateType<T extends TableName> = Database['public']['Tables'][T]['Update']

// Untyped query builder — bypasses Supabase's generic constraints
type AnyQueryBuilder = ReturnType<SupabaseClient['from']>

// ---------------------------------------------------------------------------
// Base repository
// ---------------------------------------------------------------------------

/**
 * Generic base repository providing typed CRUD operations.
 *
 * @example
 *   class BeneficiaryRepository extends BaseRepository<'beneficiaries'> {
 *     constructor(db: SupabaseClient<Database>) {
 *       super(db, 'beneficiaries')
 *     }
 *   }
 */
export abstract class BaseRepository<T extends TableName> {
  constructor(
    protected readonly db: SupabaseClient<Database>,
    protected readonly tableName: T,
  ) {}

  /** Internal helper: get an untyped query builder for this table. */
  private query(): AnyQueryBuilder {
    return (this.db as SupabaseClient).from(this.tableName as never) as AnyQueryBuilder
  }

  /**
   * Find a single row by ID.
   */
  async findById(id: string): Promise<RowType<T> | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return data as RowType<T>
  }

  /**
   * Find all rows matching a filter (simple equality).
   *
   * @param column - column name to filter on
   * @param value - value to match
   * @param limit - max rows to return (default 100)
   */
  async findBy(column: string, value: unknown, limit: number = 100): Promise<RowType<T>[]> {
    const { data, error } = await this.query()
      .select('*')
      .eq(column, value)
      .limit(limit)

    if (error) throw error
    return (data ?? []) as RowType<T>[]
  }

  /**
   * Insert a new row and return the created record.
   */
  async insert(values: InsertType<T>): Promise<RowType<T>> {
    const { data, error } = await this.query()
      .insert(values as Record<string, unknown>)
      .select('*')
      .single()

    if (error) throw error
    return data as RowType<T>
  }

  /**
   * Update a row by ID and return the updated record.
   */
  async updateById(id: string, values: UpdateType<T>): Promise<RowType<T> | null> {
    const { data, error } = await this.query()
      .update(values as Record<string, unknown>)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data as RowType<T>
  }

  /**
   * Delete a row by ID. Returns true if a row was deleted.
   */
  async deleteById(id: string): Promise<boolean> {
    const { error, count } = await this.query()
      .delete({ count: 'exact' })
      .eq('id', id)

    if (error) throw error
    return (count ?? 0) > 0
  }

  /**
   * Count rows matching a filter (simple equality).
   */
  async countBy(column: string, value: unknown): Promise<number> {
    const { count, error } = await this.query()
      .select('*', { count: 'exact', head: true })
      .eq(column, value)

    if (error) throw error
    return count ?? 0
  }
}

// ---------------------------------------------------------------------------
// Query helpers for outbox claim (SKIP LOCKED)
// ---------------------------------------------------------------------------

/**
 * Claims pending outbox rows using SELECT FOR UPDATE SKIP LOCKED.
 * This is the atomic claim primitive for the outbox worker (Vercel Cron).
 *
 * @param db - Supabase client
 * @param limit - max rows to claim (default 10)
 * @returns array of claimed outbox rows (status updated to 'PROCESSING')
 */
export async function claimPendingOutboxRows(
  db: SupabaseClient<Database>,
  limit: number = 10,
): Promise<Database['public']['Tables']['outbox']['Row'][]> {
  // Use an RPC call to execute the SKIP LOCKED claim atomically.
  // This ensures only one cron worker instance claims each row.
  const { data, error } = await (db as SupabaseClient).rpc('claim_outbox_rows' as never, {
    p_limit: limit,
  } as never)

  if (error) throw error
  return (data ?? []) as Database['public']['Tables']['outbox']['Row'][]
}
