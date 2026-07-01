import { BaseRepository } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'

export class BeneficiaryRepository extends BaseRepository<'beneficiaries'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'beneficiaries')
  }
}
