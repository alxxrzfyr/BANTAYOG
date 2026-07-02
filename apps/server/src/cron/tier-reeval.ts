import { createServiceClient } from '../lib/supabase.js'
import { computeTier } from '../domain/eligibility.js'
import { logger } from '../lib/logger.js'

export interface TierReevalResult {
  evaluated: number
  transitioned: number
}

/**
 * Worker to run daily re-evaluation of beneficiary intervention tiers.
 * Transitions beneficiaries from Tier 1 (Critical) to Tier 2 (Standard)
 * when they age past 1,000 days from conception.
 */
export async function runTierReevaluation(): Promise<TierReevalResult> {
  const db = createServiceClient()
  const cronLogger = logger.child({ requestId: 'cron-tier-reeval' })

  // 1. Query all beneficiaries currently marked as Tier 1
  const { data: beneficiaries, error } = await db
    .from('beneficiaries')
    .select('id, created_at, child_age_months, guardian_name, child_name, intervention_tier')
    .eq('intervention_tier', 1)

  if (error) {
    cronLogger.error({ error: error.message, msg: 'Failed to query Tier 1 beneficiaries' })
    return { evaluated: 0, transitioned: 0 }
  }

  if (!beneficiaries || beneficiaries.length === 0) {
    return { evaluated: 0, transitioned: 0 }
  }

  cronLogger.info({ count: beneficiaries.length, msg: 'Evaluating Tier 1 beneficiaries' })

  let transitionedCount = 0
  const currentDate = new Date()

  for (const beneficiary of beneficiaries) {
    const currentTier = computeTier(beneficiary.created_at, beneficiary.child_age_months, currentDate)

    if (currentTier === 2) {
      cronLogger.info({
        beneficiaryId: beneficiary.id,
        guardianName: beneficiary.guardian_name,
        childName: beneficiary.child_name,
        msg: 'Beneficiary has aged past 1,000 days. Transitioning Tier 1 -> Tier 2 (Standard)'
      })

      const { error: updateError } = await db
        .from('beneficiaries')
        .update({ intervention_tier: 2 })
        .eq('id', beneficiary.id)

      if (updateError) {
        cronLogger.error({
          beneficiaryId: beneficiary.id,
          error: updateError.message,
          msg: 'Failed to update intervention tier'
        })
      } else {
        transitionedCount++
      }
    }
  }

  return { evaluated: beneficiaries.length, transitioned: transitionedCount }
}
