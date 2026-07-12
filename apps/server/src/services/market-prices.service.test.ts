import { describe, it, expect } from 'vitest'
import { MarketPricesService } from './market-prices.service.js'

describe('MarketPricesService', () => {
  const service = new MarketPricesService()

  describe('searchMarketPrice', () => {
    it('returns ok(null) for empty search term', async () => {
      const result = await service.searchMarketPrice('   ')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeNull()
      }
    })

    it('finds exact matches by commodity_name', async () => {
      const result = await service.searchMarketPrice('Banana (Lakatan)')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeDefined()
        expect(result.value?.commodity_name).toBe('Banana (Lakatan)')
        expect(result.value?.price_min).toBe(70)
        expect(result.value?.price_max).toBe(110)
      }
    })

    it('finds case-insensitive partial matches by commodity_name', async () => {
      const result = await service.searchMarketPrice('beef brisket')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeDefined()
        expect(result.value?.commodity_name).toBe('Beef Brisket')
      }
    })

    it('finds matches by local_name if commodity_name misses', async () => {
      const result = await service.searchMarketPrice('Bigas')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeDefined()
        expect(result.value?.commodity_name).toBe('Kadiwa Rice-For-All')
      }
    })

    it('returns null if no match is found', async () => {
      const result = await service.searchMarketPrice('NonExistentAlienFruit')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeNull()
      }
    })
  })
})
