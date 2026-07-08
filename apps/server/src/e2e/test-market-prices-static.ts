import { MarketPricesService } from '../services/market-prices.service.js'

const service = new MarketPricesService()

async function run() {
  console.log('\n--- Testing Search (Exact Match) ---')
  const search1 = await service.searchMarketPrice('Banana (Lakatan)')
  if (search1.isOk()) {
    console.log('Search Banana:', search1.value)
  }

  console.log('\n--- Testing Search (Local Name Match) ---')
  const search2 = await service.searchMarketPrice('Liempo')
  if (search2.isOk()) {
    console.log('Search Liempo:', search2.value)
  }

  console.log('\n--- Testing Search (Partial Match) ---')
  const search3 = await service.searchMarketPrice('Well Milled')
  if (search3.isOk()) {
    console.log('Search Milled:', search3.value)
  }
}

run().catch(console.error)
