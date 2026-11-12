// BE1 owns this file. Requirements: PayPal settlement contract, section 6.
import { z } from 'zod'

export const SettlementMoneySchema = z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/)
export const SettlementStatusSchema = z.enum(['PROPOSED', 'SENT', 'PAID', 'CANCELLED'])
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>

export const SettlementItemDto = z.object({
  name: z.string(), category: z.string(), quantity: z.number().positive(),
  unitPricePhp: SettlementMoneySchema, imageUrl: z.string().nullable(),
})
export type SettlementItemDto = z.infer<typeof SettlementItemDto>

export const SettlementLineDto = z.object({
  transactionId: z.string().uuid(), amountPhp: SettlementMoneySchema, soldAt: z.string().datetime({ offset: true }),
  held: z.boolean(), holdReason: z.string().nullable(), ledgerTxHash: z.string().nullable(),
  items: z.array(SettlementItemDto),
})
export type SettlementLineDto = z.infer<typeof SettlementLineDto>

export const SettlementInvoiceDto = z.object({
  id: z.string().uuid(), merchantId: z.string().uuid(), storeName: z.string(), status: SettlementStatusSchema,
  approved: z.boolean(),
  totalAmountPhp: SettlementMoneySchema, heldAmountPhp: SettlementMoneySchema, aiSummary: z.string(),
  paypalInvoiceId: z.string().nullable(), payUrl: z.string().nullable(), createdAt: z.string().datetime({ offset: true }),
  sentAt: z.string().datetime({ offset: true }).nullable(), paidAt: z.string().datetime({ offset: true }).nullable(),
  lines: z.array(SettlementLineDto).optional(),
})
export type SettlementInvoiceDto = z.infer<typeof SettlementInvoiceDto>

export const MerchantSettlementOverviewDto = z.object({
  unpaidSaleCount: z.number().int().nonnegative(), unpaidAmountPhp: SettlementMoneySchema,
  waitingForLedgerCount: z.number().int().nonnegative(), paidAmountPhp: SettlementMoneySchema,
  invoices: z.array(SettlementInvoiceDto),
})
export type MerchantSettlementOverviewDto = z.infer<typeof MerchantSettlementOverviewDto>

export const SettlementIdParamsSchema = z.object({ id: z.string().uuid() })
export const SettlementListQuerySchema = z.object({ status: SettlementStatusSchema.optional() })
export const ApproveSettlementDto = z.strictObject({
  releaseTransactionIds: z.array(z.string().uuid()).max(100)
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate transaction ids').default([]),
})
export type ApproveSettlementDto = z.infer<typeof ApproveSettlementDto>
export const RejectSettlementDto = z.strictObject({ reason: z.string().trim().min(1).max(1000) })
export type RejectSettlementDto = z.infer<typeof RejectSettlementDto>
