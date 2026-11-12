// BE1 owns this file. Requirements: PayPal fund contract.
import { z } from 'zod'
import { SettlementMoneySchema } from './settlement.js'

export const CreateFundTopupDto = z.strictObject({
  requestId: z.string().uuid(),
  amountPhp: SettlementMoneySchema.refine(value => {
    if (!/^\d{1,6}\.\d{2}$/.test(value)) return false
    const cents = BigInt(value.replace('.', ''))
    return cents >= 100n && cents <= 10000000n
  }, 'Enter PHP 1.00 to PHP 100,000.00.'),
})
export type CreateFundTopupDto = z.infer<typeof CreateFundTopupDto>
export const FundOrderParamsSchema = z.object({ orderId: z.string().regex(/^[A-Z0-9]{17}$/) })
export const FundTopupDto = z.object({
  id: z.string().uuid(), status: z.enum(['CREATED', 'COMPLETED']), amountPhp: SettlementMoneySchema,
  feePhp: SettlementMoneySchema.nullable(), netAmountPhp: SettlementMoneySchema.nullable(),
  orderId: z.string().nullable(), captureId: z.string().nullable(), approvalUrl: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }).nullable(),
})
export type FundTopupDto = z.infer<typeof FundTopupDto>
export const FundLedgerDto = z.object({
  grossContributionsPhp: SettlementMoneySchema, feesPhp: SettlementMoneySchema,
  netContributionsPhp: SettlementMoneySchema, grantsIssuedPhp: SettlementMoneySchema,
  grantCount: z.number().int().nonnegative(), confirmedSalesPhp: SettlementMoneySchema,
  paidInvoicesPhp: SettlementMoneySchema, owedPhp: SettlementMoneySchema,
  topups: z.array(FundTopupDto),
})
export type FundLedgerDto = z.infer<typeof FundLedgerDto>
