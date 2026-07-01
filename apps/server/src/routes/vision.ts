import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createServiceClient } from '../lib/supabase.js'
import { VisionService } from '../services/vision.service.js'
import { toClassificationDTO } from '../dto/mappers.js'
import type { Env } from '../types/env.js'

const visionRoutes = new Hono<{ Bindings: Env }>()

// Enforce max image size (~10MB limit in characters)
const MAX_BASE64_LENGTH = 15 * 1024 * 1024 // ~15MB base64 string

const classifySchema = z.object({
  imageBase64: z.string().min(1).max(MAX_BASE64_LENGTH, 'Image base64 payload exceeds size limit')
})

/**
 * POST /api/vision/classify
 * Accepts inline base64 image data and returns candidate products from the catalog.
 */
visionRoutes.post('/classify', zValidator('json', classifySchema), async (c) => {
  const { imageBase64 } = c.req.valid('json')
  const db = createServiceClient()
  const visionService = new VisionService(db)

  const result = await visionService.classifyProduct(imageBase64)

  return c.json(toClassificationDTO(result))
})

export default visionRoutes
