import { BaseRepository } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'

export class AllocationRepository extends BaseRepository<'allocations'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'allocations')
  }
}
