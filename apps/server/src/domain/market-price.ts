// BE1 owns this file. Requirements: compare prices only for equivalent sale units.
import type { NonBrandedValidationDto, ValidateNonBrandedDto } from '@bantayog/schema'
import type { MarketPriceData } from '../data/market-prices.data.js'
import { formatPhp } from './php-money.js'

type PriceReview = Pick<NonBrandedValidationDto, 'priceStatus' | 'priceReasoning' |
  'researchedPriceMin' | 'researchedPriceMax' | 'researchedPriceUnit' |
  'referenceProductName' | 'referenceDate' | 'referenceSource'>

const cents = (price: number) => BigInt(formatPhp(price).replace('.', ''))
const displayCents = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`

export function reviewMarketPrice(
  input: Pick<ValidateNonBrandedDto, 'price' | 'unit' | 'unitWeightGrams'>,
  reference: MarketPriceData | null,
): PriceReview {
  if (!reference) return {
    priceStatus: 'no_reference', priceReasoning: 'No stored price reference was found. Price validation is incomplete; this is not a nutrition rejection.',
    researchedPriceMin: null, researchedPriceMax: null, researchedPriceUnit: null,
    referenceProductName: null, referenceDate: null, referenceSource: null,
  }
  const details = {
    researchedPriceMin: reference.price_min, researchedPriceMax: reference.price_max,
    researchedPriceUnit: reference.unit, referenceProductName: reference.commodity_name,
    referenceDate: reference.as_of_date, referenceSource: reference.source,
  }
  // Ratios remain integers. Never guess a piece, pack, or bunch weight from a photo.
  let numerator = 1n
  let denominator = 1n
  let weightNote = ''
  if (input.unit !== reference.unit) {
    const referenceGrams = reference.unit === 'per kilo' ? 1000 : reference.unit === 'per 100g' ? 100 : null
    if (referenceGrams !== null) {
      let saleGrams: number | undefined
      if (input.unit === 'per kilo') saleGrams = 1000
      else if (input.unit === 'per 100g') saleGrams = 100
      else if (['per piece', 'per bundle/pack', 'per dozen'].includes(input.unit)) {
        saleGrams = input.unitWeightGrams
        if (saleGrams === undefined) return { ...details, priceStatus: 'needs_weight',
          priceReasoning: `The stored reference is ${reference.unit}, but the entered price is ${input.unit}. Enter the measured weight in grams for one sale unit, or select ${reference.unit}.` }
        weightNote = `Using the entered weight of ${saleGrams} g ${input.unit}. `
      }
      if (saleGrams === undefined) return { ...details, priceStatus: 'unsupported_unit',
        priceReasoning: `Cannot compare ${input.unit} with ${reference.unit}. Select a matching weight unit; no density or weight is assumed.` }
      numerator = BigInt(saleGrams)
      denominator = BigInt(referenceGrams)
    } else if (reference.unit === 'per piece' && input.unit === 'per dozen') numerator = 12n
    else if (reference.unit === 'per dozen' && input.unit === 'per piece') denominator = 12n
    else return { ...details, priceStatus: 'unsupported_unit',
      priceReasoning: `Cannot compare ${input.unit} with ${reference.unit}. Select ${reference.unit}; no pack size is assumed.` }
  }
  // Preserve the existing 20% policy. Cross-multiply before rounding for display.
  const scale = denominator * 100n
  const lower = cents(reference.price_min) * numerator * 80n
  const upper = cents(reference.price_max) * numerator * 120n
  const entered = cents(input.price) * scale
  const valid = entered >= lower && entered <= upper
  const minimum = displayCents((lower + scale - 1n) / scale)
  const maximum = displayCents(upper / scale)
  return { ...details, priceStatus: valid ? 'valid' : 'out_of_range',
    priceReasoning: `${weightNote}Entered price: ₱${formatPhp(input.price)} ${input.unit}. Allowed range: ₱${minimum}–₱${maximum} ${input.unit}, with the program's 20% tolerance. The price is ${valid ? 'within' : 'outside'} this range.` }
}
