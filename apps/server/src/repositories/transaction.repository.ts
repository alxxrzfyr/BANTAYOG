import { BaseRepository } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'

export class TransactionRepository extends BaseRepository<'transactions'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'transactions')
  }
}
