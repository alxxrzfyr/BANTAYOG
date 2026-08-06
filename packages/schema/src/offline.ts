import { z } from 'zod'

/** How a product line item's identity was established. */
export const IdentificationMethodSchema = z.enum([
  'ONLINE_BARCODE',
  'ONLINE_GEMINI',
  'OFFLINE_BARCODE',
])
export type IdentificationMethod = z.infer<typeof IdentificationMethodSchema>
