import { BaseRepository } from '@bantayog/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'

export class MerchantRepository extends BaseRepository<'merchants'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'merchants')
  }
}
