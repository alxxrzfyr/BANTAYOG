import { describe, it, expect } from 'vitest'
import { isValidGtin, normalizeGtin, canonicalizeGtin } from './gtin.js'

describe('normalizeGtin', () => {
  it('strips whitespace and non-digit characters', () => {
    expect(normalizeGtin(' 4 006381-333931 ')).toBe('4006381333931')
  })
})

describe('canonicalizeGtin', () => {
  it('prepends a leading zero to UPC-A so it becomes EAN-13', () => {
    expect(canonicalizeGtin('036000291452')).toBe('0036000291452')
  })

  it('leaves EAN-8/EAN-13/GTIN-14 unchanged', () => {
    expect(canonicalizeGtin('96385074')).toBe('96385074')
    expect(canonicalizeGtin('4006381333931')).toBe('4006381333931')
    expect(canonicalizeGtin('12345678901234')).toBe('12345678901234')
  })
})

describe('isValidGtin', () => {
  it('accepts a valid EAN-13', () => {
    expect(isValidGtin('4006381333931')).toBe(true)
  })

  it('accepts a valid UPC-A (12 digits) after EAN-13 canonicalization', () => {
    expect(isValidGtin('036000291452')).toBe(true)
  })

  it('accepts a valid EAN-8', () => {
    expect(isValidGtin('96385074')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isValidGtin('4006381333930')).toBe(false)
  })

  it('rejects a 12-digit UPC-A with a bad check digit even after canonicalization', () => {
    expect(isValidGtin('036000291453')).toBe(false)
  })

  it('rejects an invalid length', () => {
    expect(isValidGtin('12345')).toBe(false)
  })

  it('rejects non-digit garbage', () => {
    expect(isValidGtin('not-a-barcode')).toBe(false)
  })
})
