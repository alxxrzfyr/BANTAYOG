import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Transaction lifecycle states (XState v5 machine in domain/transaction.machine.ts). */
export const TransactionStatusSchema = z.enum([
  'PENDING_CHAIN',
  'CONFIRMED',
  'DB_RECORDED',
  'BROADCAST',
  'RECONCILED',
  'FAILED',
])
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>

/** Nutritional allowlist categories (must match domain/nutrition-policy.ts). */
export const NutritionCategorySchema = z.enum([
  'FRUITS',
  'VEGETABLES',
  'MEATS',
  'BEVERAGES',
  'DAIRY',
  'GRAINS',
  'CANNED_GOODS',
  'SNACKS',
  'OTHER',
])
export type NutritionCategory = z.infer<typeof NutritionCategorySchema>

// ---------------------------------------------------------------------------
// Transaction DTOs
// ---------------------------------------------------------------------------

/** A single line item in a redemption transaction. */
export const TransactionItemDto = z.object({
  category: NutritionCategorySchema,
  name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unitPricePhp: z.number().nonnegative(),
  creditCost: z.number().nonnegative(),
})
export type TransactionItemDto = z.infer<typeof TransactionItemDto>

/** DTO for submitting a new transaction (merchant-only). */
export const CreateTransactionDto = z.object({
  qrToken: z.string().min(1),
  pin: z.string().min(4).max(12),
  items: z.array(TransactionItemDto).min(1),
  idempotencyKey: z.string().uuid(),
  photoStoragePath: z.string().optional(),
})
export type CreateTransactionDto = z.infer<typeof CreateTransactionDto>

/** DTO for a transaction as returned to admin or merchant-self. */
export const TransactionDto = z.object({
  id: z.string().uuid(),
  beneficiaryId: z.string().uuid(),
  merchantId: z.string().uuid(),
  items: z.array(TransactionItemDto),
  totalCreditDeducted: z.number().nonnegative(),
  stablecoinAmountWei: z.string(),
  onchainTxHash: z.string().nullable(),
  idempotencyKey: z.string().uuid(),
  status: TransactionStatusSchema,
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
})
export type TransactionDto = z.infer<typeof TransactionDto>

/** DTO for querying transaction status. */
export const TransactionStatusDto = z.object({
  id: z.string().uuid(),
  status: TransactionStatusSchema,
  onchainTxHash: z.string().nullable(),
  confirmedAt: z.string().datetime().nullable(),
})
export type TransactionStatusDto = z.infer<typeof TransactionStatusDto>

// ---------------------------------------------------------------------------
// Vision DTOs
// ---------------------------------------------------------------------------

/** DTO for submitting a photo for Gemini Vision classification. */
export const VisionClassifyDto = z.object({
  storagePath: z.string().min(1),
})
export type VisionClassifyDto = z.infer<typeof VisionClassifyDto>

/** DTO for a single classified item from Vision service. */
export const VisionItemDto = z.object({
  category: NutritionCategorySchema,
  name: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
})
export type VisionItemDto = z.infer<typeof VisionItemDto>

/** DTO for the vision classification result. */
export const VisionResultDto = z.object({
  items: z.array(VisionItemDto),
  processingTimeMs: z.number().nonnegative(),
})
export type VisionResultDto = z.infer<typeof VisionResultDto>

/** DTO for manual category validation. */
export const VisionManualValidateDto = z.object({
  category: NutritionCategorySchema,
  name: z.string().min(1).max(200),
})
export type VisionManualValidateDto = z.infer<typeof VisionManualValidateDto>
