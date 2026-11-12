// BE1 owns this file. Requirements: PayPal settlement contract, section 5.
import { z } from 'zod'
import { isPriceAbove } from './php-money.js'

export const SETTLEMENT_FALLBACK_SUMMARY = 'Price checks are complete. The AI summary is unavailable. Review the sale proof before approval.'
export interface ReviewedSale {
  id: string
  items: { name: string; unitPricePhp: string | number; referencePricePhp: string | number | null }[]
}
export interface SettlementReview {
  aiSummary: string
  held: { transactionId: string; reason: string }[]
}

const modelReview = z.object({
  aiSummary: z.string().trim().min(1).max(4000),
  held: z.array(z.object({ transactionId: z.string(), reason: z.string().trim().min(1).max(1000) })).max(100),
})

export function decideSettlementHolds(sales: ReviewedSale[], model: unknown): SettlementReview {
  const parsed = modelReview.safeParse(model)
  const held = sales.flatMap(sale => {
    const overpriced = sale.items.find(item => item.referencePricePhp !== null && isPriceAbove(item.unitPricePhp, item.referencePricePhp))
    const unknown = sale.items.some(item => item.referencePricePhp === null)
    const modelHold = parsed.success ? parsed.data.held.find(hold => hold.transactionId === sale.id) : undefined
    if (!overpriced && !(unknown && modelHold)) return []
    return [{ transactionId: sale.id, reason: modelHold?.reason ?? `${overpriced?.name} exceeds its reference price.` }]
  })
  return { aiSummary: parsed.success ? parsed.data.aiSummary : SETTLEMENT_FALLBACK_SUMMARY, held }
}
