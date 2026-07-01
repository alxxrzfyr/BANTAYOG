import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createServiceClient } from '../lib/supabase.js'
import { ProductsService } from '../services/products.service.js'
import type { Env } from '../types/env.js'

const productRoutes = new Hono<{ Bindings: Env }>()

const validateSchema = z.object({
  name: z.string().min(1)
})

/**
 * POST /api/products/validate
 * Accepts a product name and validates it against the catalog.
 */
productRoutes.post('/validate', zValidator('json', validateSchema), async (c) => {
  const { name } = c.req.valid('json')
  const db = createServiceClient()
  const productsService = new ProductsService(db)

  const result = await productsService.validateProduct(name)

  if (!result.matched) {
    return c.json({
      matched: false,
      reason: result.reason
    }, 200) // Keep as 200 or 404 depending on preference. A successful check that fails to match is still a valid response.
  }

  return c.json(result)
})

export default productRoutes
