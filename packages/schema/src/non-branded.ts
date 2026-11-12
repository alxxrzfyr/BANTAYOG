// BE1 owns this file. Requirements: non-branded product price and image validation.
import { z } from 'zod'
import { NutritionCategorySchema } from './transaction.js'

export const NonBrandedUnitSchema = z.enum([
  'per piece', 'per 100g', 'per kilo', 'per bundle/pack', 'per liter', 'per dozen',
])
export const ValidateNonBrandedDto = z.object({
  imageBase64: z.string().trim().min(1).max(15 * 1024 * 1024),
  productName: z.string().trim().min(1).max(200),
  price: z.number().positive().max(9999999999.99)
    .refine(value => /^\d+(\.\d{1,2})?$/.test(String(value)), 'Use at most two decimal places.'),
  unit: NonBrandedUnitSchema,
  unitWeightGrams: z.number().int().positive().max(1000000).optional(),
})
export type ValidateNonBrandedDto = z.infer<typeof ValidateNonBrandedDto>

export const NonBrandedValidationDto = z.object({
  isJustified: z.boolean(),
  imageMatches: z.boolean(),
  isChildFriendly: z.boolean(),
  reasoning: z.string(),
  flaggedIngredients: z.array(z.string()),
  suggestedCategory: NutritionCategorySchema,
  mismatchReason: z.string().optional(),
  priceStatus: z.enum(['valid', 'out_of_range', 'needs_weight', 'unsupported_unit', 'no_reference']),
  priceReasoning: z.string(),
  researchedPriceMin: z.number().nonnegative().nullable(),
  researchedPriceMax: z.number().nonnegative().nullable(),
  researchedPriceUnit: z.string().nullable(),
  referenceProductName: z.string().nullable(),
  referenceDate: z.string().nullable(),
  referenceSource: z.string().nullable(),
})
export type NonBrandedValidationDto = z.infer<typeof NonBrandedValidationDto>
