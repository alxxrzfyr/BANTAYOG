import { createClient } from '@supabase/supabase-js'
import { MarketPricesService } from '../services/market-prices.service.js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const db = createClient(supabaseUrl, supabaseKey)
const service = new MarketPricesService(db as any)

async function run() {
  console.log('--- Testing Ingestion ---')
  const ingestRes = await service.ingestMockData()
  if (ingestRes.isErr()) {
    console.error('Ingestion failed:', ingestRes.error)
  } else {
    console.log('Ingestion success:', ingestRes.value)
  }

  console.log('\n--- Testing Search (Exact Match) ---')
  const search1 = await service.searchMarketPrice('Banana')
  if (search1.isOk()) {
    console.log('Search Banana:', search1.value)
  }

  console.log('\n--- Testing Search (Local Name Match) ---')
  const search2 = await service.searchMarketPrice('Liempo')
  if (search2.isOk()) {
    console.log('Search Liempo:', search2.value)
  }

  console.log('\n--- Testing Search (Partial Match) ---')
  const search3 = await service.searchMarketPrice('Milled')
  if (search3.isOk()) {
    console.log('Search Milled:', search3.value)
  }
}

run().catch(console.error)
