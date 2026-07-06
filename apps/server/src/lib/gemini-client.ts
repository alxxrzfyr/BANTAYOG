import { GoogleGenAI } from '@google/genai'

const FALLBACK_CHAIN = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-pro-latest'
]

export async function callGeminiWithFallback(
  options: {
    prompt: string
    imageBase64?: string
    responseSchema?: any
    temperature?: number
  }
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.')
  }

  let cleanBase64 = ''
  let mimeType = 'image/jpeg'
  if (options.imageBase64) {
    if (options.imageBase64.startsWith('data:')) {
      const match = options.imageBase64.match(/^data:([^;]+);base64,(.*)$/)
      if (match) {
        mimeType = match[1]
        cleanBase64 = match[2]
      } else {
        cleanBase64 = options.imageBase64
      }
    } else {
      cleanBase64 = options.imageBase64
    }
  }

  let lastError: any = null

  for (const model of FALLBACK_CHAIN) {
    try {
      console.log(`[Gemini SDK fallback] Attempting call with model: ${model}`)
      const ai = new GoogleGenAI({ apiKey })

      const parts: any[] = []
      if (cleanBase64) {
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType
          }
        })
      }
      parts.push({ text: options.prompt })

      const apiResponse = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts
          }
        ],
        config: {
          temperature: options.temperature ?? 0.1,
          tools: options.responseSchema ? undefined : [{ googleSearch: {} }],
          responseMimeType: options.responseSchema ? 'application/json' : undefined,
          responseSchema: options.responseSchema
        }
      })

      const text = apiResponse.text
      if (!text) {
        throw new Error(`Model ${model} returned empty response text`)
      }

      if (options.responseSchema) {
        return JSON.parse(text.trim())
      }
      return text.trim()
    } catch (err: any) {
      const errMsg = err.message || '';
      console.warn(`[Gemini SDK fallback] Model ${model} failed: ${errMsg}`)
      
      // Fallback on any rate limits (429), quota exceeded, or internal errors
      lastError = err
    }
  }

  throw lastError || new Error('All models in fallback chain failed.')
}
