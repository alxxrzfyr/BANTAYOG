import { GoogleGenAI } from '@google/genai'
import pRetry from 'p-retry'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'
import { ProductsService } from './products.service.js'
import { AppResult, ok, err, ValidationError } from '../lib/errors.js'

export interface CandidateResult {
  name: string
  confidence: number
  product: {
    id: string
    name: string
    eligibility_status: 'eligible' | 'ineligible'
    category: string
  } | null
}

export interface VisionClassificationSuccess {
  identified: true
  candidates: CandidateResult[]
}

export interface VisionClassificationFailure {
  identified: false
  reason: string
}

export type VisionClassificationResult = VisionClassificationSuccess | VisionClassificationFailure

export class VisionService {
  private productsService: ProductsService
  private ai: GoogleGenAI

  constructor(db: SupabaseClient<Database>) {
    this.productsService = new ProductsService(db)
    
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn('WARNING: GEMINI_API_KEY environment variable is not set.')
    }
    this.ai = new GoogleGenAI({ apiKey })
  }

  /**
   * Identifies a product in an image using Gemini vision,
   * then matches each candidate against the local products catalog.
   */
  async classifyProduct(imageBase64: string): Promise<AppResult<VisionClassificationResult>> {
    if (!imageBase64 || imageBase64.trim() === '') {
      return ok({ identified: false, reason: 'Empty image data provided' })
    }

    // Strip base64 metadata prefix if present
    let cleanBase64 = imageBase64
    let mimeType = 'image/jpeg'
    if (imageBase64.startsWith('data:')) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.*)$/)
      if (match) {
        mimeType = match[1]
        cleanBase64 = match[2]
      }
    }

    try {
      const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash'
      const confidenceThreshold = parseFloat(process.env.GEMINI_CONFIDENCE_THRESHOLD || '0.7')

      // Use p-retry for resilient API calls with exponential backoff
      const apiResponse = await pRetry(
        async () => {
          return await this.ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: cleanBase64,
                      mimeType
                    }
                  },
                  {
                    text: 'Analyze the product shown in this image. Identify the brand and product name. Return a list of candidates sorted by likelihood.'
                  }
                ]
              }
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  candidates: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        name: { type: 'STRING', description: 'Identified name of the product' },
                        confidence: { type: 'NUMBER', description: 'Confidence score from 0.0 to 1.0' }
                      },
                      required: ['name', 'confidence']
                    }
                  }
                },
                required: ['candidates']
              }
            }
          })
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 3000,
          onFailedAttempt: (error: any) => {
            console.warn(`Gemini Vision API call failed (attempt ${error.attemptNumber}): ${error.message}`)
          }
        }
      )

      const text = apiResponse.text
      if (!text) {
        return ok({ identified: false, reason: 'Gemini returned empty response text' })
      }

      const responseObj = JSON.parse(text)
      const rawCandidates = responseObj.candidates || []

      // 2. Filter candidates below threshold
      const filteredCandidates = rawCandidates.filter(
        (c: any) => c && typeof c.name === 'string' && typeof c.confidence === 'number' && c.confidence >= confidenceThreshold
      )

      if (filteredCandidates.length === 0) {
        return ok({ identified: false, reason: 'unrecognizable' })
      }

      // 3. For each candidate, match against catalog
      const candidatesWithProducts: CandidateResult[] = []

      for (const candidate of filteredCandidates) {
        const matchResult = await this.productsService.validateProduct(candidate.name)
        if (matchResult.isOk()) {
          const matchResultValue = matchResult.value
          candidatesWithProducts.push({
            name: candidate.name,
            confidence: candidate.confidence,
            product: matchResultValue.matched ? matchResultValue.product : null
          })
        } else {
          candidatesWithProducts.push({
            name: candidate.name,
            confidence: candidate.confidence,
            product: null
          })
        }
      }

      return ok({
        identified: true,
        candidates: candidatesWithProducts
      })

    } catch (error: any) {
      console.error('Vision classification failed:', error)
      return err(new ValidationError(`Vision classification failed: ${error.message}`))
    }
  }
}

