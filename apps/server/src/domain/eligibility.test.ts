import { describe, it, expect } from 'vitest'
import { computeTier, computeAgeInDays, calculateBirthdate } from './eligibility.js'

describe('Eligibility Domain Logic', () => {
  it('calculates birthdate correctly', () => {
    const createdAt = new Date('2026-06-30T00:00:00.000Z')
    const ageMonths = 10
    const birthdate = calculateBirthdate(createdAt, ageMonths)

    // Expected birthdate should be 10 * 30.4375 days prior to createdAt
    const expectedMs = createdAt.getTime() - 10 * 30.4375 * 24 * 60 * 60 * 1000
    expect(birthdate.getTime()).toBe(expectedMs)
  })

  it('computes age in days correctly', () => {
    const createdAt = new Date('2026-06-30T00:00:00.000Z')
    const ageMonths = 12
    const currentDate = new Date('2026-06-30T00:00:00.000Z') // Same day as registration

    // 12 months in days = 12 * 30.4375 = 365.25 => Math.floor = 365
    const ageInDays = computeAgeInDays(createdAt, ageMonths, currentDate)
    expect(ageInDays).toBe(365)
  })

  it('assigns Tier 1 (Critical) to children <= 1000 days from conception (<= 730 days from birth)', () => {
    const createdAt = new Date('2026-06-30T00:00:00.000Z')
    const ageMonths = 23 // Under 2 years old (approx 700 days from birth)
    const currentDate = new Date('2026-06-30T00:00:00.000Z')

    const tier = computeTier(createdAt, ageMonths, currentDate)
    expect(tier).toBe(1)
  })

  it('assigns Tier 2 (Standard) to children > 1000 days from conception (> 730 days from birth)', () => {
    const createdAt = new Date('2026-06-30T00:00:00.000Z')
    const ageMonths = 25 // Over 2 years old (approx 760 days from birth)
    const currentDate = new Date('2026-06-30T00:00:00.000Z')

    const tier = computeTier(createdAt, ageMonths, currentDate)
    expect(tier).toBe(2)
  })
})
