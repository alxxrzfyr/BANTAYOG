import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const MerchantStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
])
export type MerchantStatus = z.infer<typeof MerchantStatusSchema>

// ---------------------------------------------------------------------------
// Merchant DTOs
// ---------------------------------------------------------------------------

/** DTO for registering a new merchant (admin-only). */
export const CreateMerchantDto = z.object({
  storeName: z.string().min(1).max(200),
  ownerName: z.string().min(1).max(200),
  mobileNumberE164: z
    .string()
    .min(1)
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format (e.g. +639171234567)'),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM address')
    .optional(),
})
export type CreateMerchantDto = z.infer<typeof CreateMerchantDto>

/** DTO for a merchant as returned to admin or merchant-self. */
export const MerchantDto = z.object({
  id: z.string().uuid(),
  authUserId: z.string().uuid(),
  storeName: z.string(),
  ownerName: z.string(),
  mobileNumberE164: z.string(),
  walletAddress: z.string().nullable(),
  walletBalance: z.number(),
  status: MerchantStatusSchema,
  createdAt: z.string().datetime(),
})
export type MerchantDto = z.infer<typeof MerchantDto>

/** DTO for updating a merchant profile (merchant-self or admin). */
export const UpdateMerchantDto = z.object({
  storeName: z.string().min(1).max(200).optional(),
  ownerName: z.string().min(1).max(200).optional(),
  mobileNumberE164: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format')
    .optional(),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM address')
    .optional(),
  status: MerchantStatusSchema.optional(),
})
export type UpdateMerchantDto = z.infer<typeof UpdateMerchantDto>
