# ADR 002: Dynamic Backend-Only Tier Computation

## Context

BANTAYOG implements a segmented nutrition policy with two tiers of assistance:
- **Tier 1 (Critical)**: Children ≤ 1,000 days old from conception (gestation + childhood). Assumed to be under 730 days (2 years) old from birth.
- **Tier 2 (Standard)**: Children > 1,000 days old.

A child's age changes daily. Assigning a static tier at registration time would result in children remaining in Tier 1 long after they have passed their 1,000-day window, resulting in subsidy leakages and policy violations.

## Decision

We will compute the intervention tier dynamically inside the backend service using pure functions, and implement a hybrid re-evaluation strategy:
1. **Dynamic Pure Computation**: The tier is calculated from the current date relative to registration time (`created_at` and `child_age_months`) using the `computeTier()` domain function.
2. **On-Read Re-evaluation**: Tiers are computed dynamically for all list, view, and verify operations.
3. **Scan-time Update**: At checkout scan, the backend computes the tier. If the tier has changed, it updates the `intervention_tier` database column before verifying the transaction.
4. **Daily Batch Job**: A cron job runs every night to check all beneficiaries in Tier 1, re-evaluating and transitioning them to Tier 2 in the database when they cross the 1,000-day limit.

## Consequences

### Benefits
- **Accuracy**: Ensures infants are transitioned out of the critical tier precisely on time.
- **Security**: The tier calculation is a protected domain rule inside the server's boundaries, protecting the system from client-side manipulation.

### Drawbacks
- **Query overhead**: Listing beneficiaries requires calculation. This is mitigated by indexing, caching, and persisting the current state in the `intervention_tier` column for fast query filters.
