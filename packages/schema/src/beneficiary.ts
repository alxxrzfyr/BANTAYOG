import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const EligibilityStatusSchema = z.enum([
  'PENDING',
  'ELIGIBLE',
  'INELIGIBLE',
  'SUSPENDED',
])
export type EligibilityStatus = z.infer<typeof EligibilityStatusSchema>

// ---------------------------------------------------------------------------
// Beneficiary DTOs
// ---------------------------------------------------------------------------

/** DTO for creating a new beneficiary (admin-only). */
export const CreateBeneficiaryDto = z.object({
  guardianName: z.string().min(1).max(200),
  guardianMobileHash: z.string().min(1),
  childName: z.string().min(1).max(200),
  childAgeMonths: z.number().int().min(0).max(120),
  monthlyIncomePhp: z.number().nonnegative(),
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
  pin: z.string().min(4).max(12),
})
export type CreateBeneficiaryDto = z.infer<typeof CreateBeneficiaryDto>

/** DTO for a beneficiary as returned to the admin (no PII leak to merchants). */
export const BeneficiaryDto = z.object({
  id: z.string().uuid(),
  guardianName: z.string(),
  guardianMobileHash: z.string(),
  childName: z.string(),
  childAgeMonths: z.number().int(),
  monthlyIncomePhp: z.number(),
  gpsLat: z.number(),
  gpsLng: z.number(),
  eligibilityStatus: EligibilityStatusSchema,
  creditBalance: z.number().nonnegative(),
  cardSerial: z.string().nullable(),
  activatedAt: z.string().datetime().nullable(),
  deactivatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type BeneficiaryDto = z.infer<typeof BeneficiaryDto>

/** DTO for the beneficiary balance query (admin-only). */
export const BeneficiaryBalanceDto = z.object({
  beneficiaryId: z.string().uuid(),
  creditBalance: z.number().nonnegative(),
  onchainBalanceWei: z.string().nullable(),
})
export type BeneficiaryBalanceDto = z.infer<typeof BeneficiaryBalanceDto>

/** DTO for issuing a QR token to a beneficiary (admin-only). */
export const IssueQrTokenDto = z.object({
  beneficiaryId: z.string().uuid(),
})
export type IssueQrTokenDto = z.infer<typeof IssueQrTokenDto>

/** DTO returned after QR token issuance. */
export const QrTokenDto = z.object({
  jwsCompact: z.string(),
  cardSerial: z.string(),
  expiresAt: z.string().datetime(),
})
export type QrTokenDto = z.infer<typeof QrTokenDto>

/** DTO for merchant-side QR verification (no PII returned). */
export const QrVerifyDto = z.object({
  token: z.string().min(1),
})
export type QrVerifyDto = z.infer<typeof QrVerifyDto>

/** DTO returned to merchant after QR verification (minimal, no PII). */
export const QrVerifyResultDto = z.object({
  valid: z.boolean(),
  cardSerial: z.string().nullable(),
  creditBalance: z.number().nullable(),
  expired: z.boolean(),
  revoked: z.boolean(),
})
export type QrVerifyResultDto = z.infer<typeof QrVerifyResultDto>
