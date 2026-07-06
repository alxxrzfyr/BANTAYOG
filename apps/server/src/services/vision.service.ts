import { GoogleGenAI } from '@google/genai'
import pRetry from 'p-retry'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'
import { ProductsService } from './products.service.js'
import { type AppResult, ok, err, ValidationError } from '../lib/errors.js'
import { callGeminiWithFallback } from '../lib/gemini-client.js'

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
  private db: SupabaseClient<Database>

  constructor(db: SupabaseClient<Database>) {
    this.db = db
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
              temperature: 0.1,
              tools: [{ googleSearch: {} }],
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

      const filteredCandidates = rawCandidates.filter(
        (c: any) => c && typeof c.name === 'string' && typeof c.confidence === 'number' && c.confidence >= confidenceThreshold
      )

      if (filteredCandidates.length === 0) {
        return ok({ identified: false, reason: 'unrecognizable' })
      }

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

  /**
   * Prompts Gemini to analyze the product in an image and return a child safety verdict.
   */
  async analyzeChildSafety(imageBase64: string): Promise<AppResult<any>> {
    if (!imageBase64 || imageBase64.trim() === '') {
      return err(new ValidationError('Empty image data provided'))
    }

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
      const model = process.env.GEMINI_VISION_MODEL || 'gemini-1.5-flash'

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
                    text: 'Identify the product brand and name in this image. Grounding instruction: Search the web/internet to verify the exact ingredients, sugar content, chemical additives, common allergens, and child-suitability guidelines for this product. Base your analysis only on verified web sources and what is visibly identifiable in the image. If the product, brand, or ingredients cannot be confidently identified (due to dark image, poor lighting, or blur), return "Unrecognizable" as the product_name and false for is_child_friendly.'
                  }
                ]
              }
            ],
            config: {
              temperature: 0.1,
              tools: [{ googleSearch: {} }],
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  product_name: { type: 'STRING', description: 'Name of the identified product' },
                  is_child_friendly: { type: 'BOOLEAN', description: 'Whether the product is child-friendly / suitable for children' },
                  flagged_ingredients: { 
                    type: 'ARRAY', 
                    items: { type: 'STRING' },
                    description: 'List of ingredients that are concerning or flagged (empty if none)'
                  },
                  reasoning: { type: 'STRING', description: 'Explanation or reasoning for the child-safety verdict' }
                },
                required: ['product_name', 'is_child_friendly', 'flagged_ingredients', 'reasoning']
              }
            }
          })
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 3000,
          onFailedAttempt: (error: any) => {
            console.warn(`Gemini Child Safety Vision API call failed (attempt ${error.attemptNumber}): ${error.message}`)
          }
        }
      )

      const text = apiResponse.text
      if (!text) {
        return err(new ValidationError('Gemini returned empty response text'))
      }

      const responseObj = JSON.parse(text)
      return ok(responseObj)

    } catch (error: any) {
      console.error('Child safety vision analysis failed:', error)
      return err(new ValidationError(`Child safety vision analysis failed: ${error.message}`))
    }
  }

  /**
   * New 3-Step Pipeline replacing analyzeScan
   */
  async analyzeScan(imageBase64: string): Promise<AppResult<any>> {
    if (!imageBase64 || imageBase64.trim() === '') {
      return err(new ValidationError('Empty image data provided'))
    }

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
      // ======================================================================
      // STEP 0: Fast-path match against public.products
      // ======================================================================
      try {
        console.log('[VisionService] Step 0: Extracting embedding for captured image...')
        const embedResult = await this.ai.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: [
            { role: 'user', parts: [{ inlineData: { data: cleanBase64, mimeType } }] }
          ]
        })
        const queryEmbedding = embedResult.embeddings?.[0]?.values

        if (queryEmbedding) {
          console.log('[VisionService] Step 0: Querying match_product_embeddings...')
          const { data: candidates, error: rpcError } = await (this.db as any).rpc('match_product_embeddings', {
            query_embedding: queryEmbedding as any,
            match_threshold: 0.4, // Lowered to 0.4 so candidates are returned for Gemini verification
            match_count: 3
          })

          if (!rpcError && candidates && candidates.length > 0) {
            console.log(`[VisionService] Step 0: Found ${candidates.length} candidate(s). Verifying visually...`)
            
            const candidateParts: any[] = []
            const candidateMap: any[] = []
            let cIndex = 0

            for (const cand of candidates) {
              if (cand.reference_image_url) {
                try {
                  const response = await fetch(cand.reference_image_url)
                  if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer()
                    const candBase64 = Buffer.from(arrayBuffer).toString('base64')
                    candidateParts.push({ text: `Candidate ${cIndex}: ${cand.name}` })
                    candidateParts.push({
                      inlineData: { data: candBase64, mimeType: 'image/jpeg' }
                    })
                    candidateMap.push(cand)
                    cIndex++
                  }
                } catch (e) {
                   console.warn(`[VisionService] Failed to fetch candidate image: ${cand.reference_image_url}`)
                }
              }
            }

            if (candidateMap.length > 0) {
              const verificationPrompt = `You are a product matching assistant.
You are given a "Captured Image" and a list of "Candidate Images" with their indices.
Your task is to determine if the Captured Image is the EXACT SAME PRODUCT (accounting for angle/lighting/minor logo differences) as any of the Candidate Images.
Return ONLY JSON with the format:
{
  "match_found": boolean,
  "matched_candidate_index": number | null
}
Only return match_found: true if you are highly confident.`

              const parts = [
                { text: "Captured Image:" },
                { inlineData: { data: cleanBase64, mimeType } },
                { text: "Candidate Images:" },
                ...candidateParts,
                { text: verificationPrompt }
              ]

              const model = 'gemini-2.5-flash'
              const verificationResponse = await this.ai.models.generateContent({
                model,
                contents: [{ role: 'user', parts }],
                config: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: 'OBJECT',
                    properties: {
                      match_found: { type: 'BOOLEAN' },
                      matched_candidate_index: { type: 'NUMBER', nullable: true }
                    },
                    required: ['match_found']
                  }
                }
              })

              const text = verificationResponse.text
              if (text) {
                const res = JSON.parse(text)
                if (res.match_found && res.matched_candidate_index !== null && res.matched_candidate_index !== undefined) {
                  const matchedProduct = candidateMap[res.matched_candidate_index]
                  if (matchedProduct) {
                    console.log(`[VisionService] Step 0: Confirmed match for ${matchedProduct.name}`)
                    return ok({
                      status: 'identified',
                      productName: matchedProduct.name,
                      eligibilityStatus: matchedProduct.eligibility_status,
                      isChildFriendly: matchedProduct.eligibility_status === 'eligible',
                      priceRangeMin: matchedProduct.price_range_min,
                      priceRangeMax: matchedProduct.price_range_max,
                      reasoning: 'Database match',
                      flaggedIngredients: []
                    })
                  }
                }
              }
            }
          }
        }
        console.log('[VisionService] Step 0 found no match. Proceeding to Step 1.')
      } catch (step0Error) {
        console.warn('[VisionService] Step 0 failed (embeddings/RPC error). Falling back to Step 1.', step0Error)
      }

      // ======================================================================
      // STEP 1: Grounded identification call (Fallback pipeline)
      // ======================================================================
      const step1Prompt = `Analyze the product shown in this image.
Grounding instruction: Only assert a product identification or nutritional judgment you are confident in from what's visible in the image or verifiable via web search. If uncertain, say so rather than guessing.
Inspect not just the largest printed text, but also logos, circular seals, badges, and small emblem marks — brand names are often embedded inside these.
Use web search to confirm the full canonical brand+product name (not just what's visually legible).

Classify the outcome into exactly one of three statuses:
- "blurry": Use this ONLY if the image is too blurry, too dark, or too low quality to analyze.
- "unrecognized": Use this if you cannot confidently identify the exact brand or product name, but the image is not blurry (e.g. local brand without an internet match, or obscure label).
- "identified": Use this if you are confident in the product name and brand.

If the status is "unrecognized" or "identified", perform a child safety gate evaluation: is it good/safe for children? (is_child_friendly). List any flagged ingredients (e.g. high sugar, high sodium, artificial preservatives, common allergens) and explain your reasoning.
Keep the reasoning extremely concise, at most 2 sentences.
If the status is "identified", also research a typical retail market price (base price) in Philippine Pesos (PHP) for this product in the Philippines.

Return your analysis as text, ensuring you clearly state the status, product name, child safety evaluation, flagged ingredients, and researched base price.`

      const step1ResultText = await callGeminiWithFallback({
        prompt: step1Prompt,
        imageBase64: cleanBase64,
        temperature: 0.1,
        useGoogleSearch: false  // googleSearch conflicts with image input on structured calls; disabled for reliability
      })

      // If step 1 text clearly indicates it's blurry, short-circuit to save Step 2 API call
      const lowerText = step1ResultText.toLowerCase()
      if (lowerText.includes('blurry') || lowerText.includes('status: blurry')) {
         console.log('[VisionService] Step 1 returned blurry. Skipping Step 2.')
         return ok({
           status: 'blurry',
           reasoning: 'Photo is too blurry to analyze — please retake the picture'
         })
      }
      
      // ======================================================================
      // STEP 2: Structured extraction call
      // ======================================================================
      console.log('[VisionService] Proceeding to Step 2...')
      const step2Prompt = `You are a data extraction assistant.
Extract structured data from the provided "Analysis Text".

Analysis Text:
"""
${step1ResultText}
"""

Return JSON matching this schema based ONLY on the Analysis Text:
{
  "status": "blurry" | "unrecognized" | "identified",
  "product_name": "identified product name with brand (empty if unrecognized or blurry)",
  "is_child_friendly": boolean,
  "reasoning": "A concise explanation for child safety verdict (at most 2 sentences)",
  "flagged_ingredients": ["array of concerning ingredients"],
  "researched_base_price": number (typical price in PHP, or null if blurry/unrecognized)
}`

      const schema = {
        type: 'OBJECT',
        properties: {
          status: { type: 'STRING', enum: ['blurry', 'unrecognized', 'identified'] },
          product_name: { type: 'STRING', description: 'Product name with brand' },
          is_child_friendly: { type: 'BOOLEAN', description: 'Is suitable for children' },
          reasoning: { type: 'STRING', description: 'Detailed reasoning for the nutritional verdict' },
          flagged_ingredients: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'List of flagged ingredients'
          },
          researched_base_price: { type: 'NUMBER', description: 'Typical price in PHP or null' }
        },
        required: ['status', 'product_name', 'is_child_friendly', 'reasoning', 'flagged_ingredients']
      }

      const step2Result = await callGeminiWithFallback({
        prompt: step2Prompt,
        temperature: 0.1,
        responseSchema: schema,
        useGoogleSearch: false
      })

      const result = step2Result

      if (result.status === 'blurry') {
        return ok({
          status: 'blurry',
          reasoning: 'Photo is too blurry to analyze — please retake the picture'
        })
      }

      if (result.status === 'unrecognized') {
        return ok({
          status: 'unrecognized',
          productName: result.product_name || 'Unrecognized Brand', // Include extracted text if any
          isChildFriendly: result.is_child_friendly,
          reasoning: result.reasoning,
          flaggedIngredients: result.flagged_ingredients
        })
      }

      if (result.status === 'identified') {
        const pName = result.product_name || 'Identified Product'
        
        // Return without DB insert, fallback pipeline results are runtime-only
        const basePrice = result.researched_base_price || 50
        return ok({
          status: 'identified',
          productName: pName,
          eligibilityStatus: result.is_child_friendly ? 'eligible' : 'ineligible',
          isChildFriendly: result.is_child_friendly,
          priceRangeMin: Math.max(0, basePrice - 10),
          priceRangeMax: basePrice + 10,
          reasoning: result.reasoning,
          flaggedIngredients: result.flagged_ingredients
        })
      }

      return err(new ValidationError('Invalid status returned from Gemini API'))
    } catch (error: any) {
      console.error('Unified scan analysis failed:', error)
      // Surface specific error types for better client-side messaging
      const errMsg: string = error.message || ''
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        return err(new ValidationError('rate_limit: AI service is temporarily busy. Please wait a moment and try again.'))
      }
      if (errMsg.includes('INVALID_ARGUMENT') || errMsg.includes('400')) {
        return err(new ValidationError(`image_error: Could not process the image. Try capturing again in better lighting. (${errMsg.slice(0, 100)}`))
      }
      return err(new ValidationError(`scan_error: ${errMsg.slice(0, 200)}`))
    }
  }
}
