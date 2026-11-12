# PayPal fund: build contract

This document defines phase 2 (sandbox contributions) and phase 3 (fund-backed grants) of the payment system.
The invoice flow in [the settlement build](paypal-settlement.md) passed its live sandbox check on November 12, 2026.
PayPal invoice `INV2-4H7T-DMAM-TJNV-R64S` was paid for PHP 50.00.
BANTAYOG confirmed `PAID` status.
A second claim returned no eligible sale.

## 1. Phase 2: Sandbox contributions

- `/fund` allows a funder to approve a sandbox contribution in PayPal. The server creates and captures an Orders v2 order. The return page never treats a redirect as payment proof.
- The contribution amount is PHP 1.00 to PHP 100,000.00. Amounts use strings with two decimal places.
- A client request UUID fixes one amount and one order. A changed amount requires a new request UUID.
- Before capture, the server reads the saved order and verifies its ID, `CAPTURE` intent, reference, PHP currency, and amount. Only an approved order can be captured.
- After capture, the server reads the order again. One final `COMPLETED` capture must match the stored amount. Gross, PayPal fee, and net must use PHP. SQL verifies `gross = fee + net`.
- A retry reads a completed order and records the same capture. It never creates a second deposit. The database enforces unique order and capture IDs. No payer name or email is stored.
- Migration `00019_paypal_fund.sql` adds table `fund_topups`, views `fund_topup_details` and `fund_ledger_summary`, and functions `create_fund_topup` and `record_fund_capture`. All objects are service-only.

## 2. Phase 3: Fund-backed grants

Phase 3 connects captured PayPal funds to the grant issuance endpoint.
The rule is: **No captured PayPal money, no new grant.**
Contributions do not automatically issue credits.
The existing administrator grant endpoint (`PATCH /api/beneficiaries/:id/credits`) reserves captured funds first.

### Database boundary (migration `00020_fund_backed_grants.sql`)

Migration `00020_fund_backed_grants.sql` adds table `fund_grant_reservations`:

| Column | Type | Constraint |
| --- | --- | --- |
| `beneficiary_id` | UUID | PK, references `beneficiaries(id)` ON DELETE RESTRICT (non-cascading FK) |
| `attempt_id` | UUID | NOT NULL, UNIQUE |
| `amount_php` | NUMERIC(12,2) | NOT NULL, CHECK `amount_php IN (5000.00, 3500.00)` |
| `status` | TEXT | NOT NULL, default `RESERVED`, CHECK `status IN ('RESERVED', 'ISSUED')` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` |

Row-Level Security is enabled.
Permissions are revoked from `PUBLIC`, `anon`, and `authenticated`.
Only `service_role` has `SELECT` permission.
Application writes use the two functions only.
Existing authorization, RBAC, RLS policies, and `settle_sale` remain unchanged.

### Functions and locking

The database provides two `SECURITY DEFINER` functions with fixed `search_path = public`:

```sql
reserve_grant_funding(p_beneficiary_id UUID, p_attempt_id UUID, p_amount_php TEXT) RETURNS JSONB;
mark_grant_funded(p_beneficiary_id UUID, p_attempt_id UUID) RETURNS BOOLEAN;
```

Both functions require `transaction_isolation = 'read committed'`.
Both functions execute `PERFORM pg_advisory_xact_lock(1111576148, 1);` in a separate statement before any reads.
This separate statement guarantees that queries see a fresh snapshot after waiting for the lock.

Behavior of `reserve_grant_funding`:
1. Reject null IDs and text amounts other than `'5000.00'` and `'3500.00'` (raises SQL error 22023).
2. Take advisory lock `(1111576148, 1)`.
3. If an allocation already exists for `p_beneficiary_id` in `allocations`, or an `ISSUED` row exists in `fund_grant_reservations`, return `{ "outcome": "issued" }`.
4. If any row exists in `fund_grant_reservations` for `p_beneficiary_id`, return `{ "outcome": "busy" }`. This includes the same attempt ID or concurrent attempts.
5. Calculate available funding:
   - Sum `net_amount_php` of `fund_topups` where `status = 'COMPLETED'`.
   - Subtract sum of `amount_php` of all rows in `fund_grant_reservations` (both `RESERVED` and `ISSUED`).
   - PayPal fees are excluded. Failed or uncompleted top-ups do not add funds.
6. If available funding is less than requested amount, return `{ "outcome": "insufficient", "availablePhp": "<amount>" }`.
7. Otherwise, insert the reservation row with status `RESERVED` and return `{ "outcome": "acquired" }`.
8. Only an `acquired` result permits chain submission.

Behavior of `mark_grant_funded`:
1. Take advisory lock `(1111576148, 1)`.
2. Update `fund_grant_reservations` to `status = 'ISSUED'` where `beneficiary_id = p_beneficiary_id` and `attempt_id = p_attempt_id`, and a row exists in `allocations` for that beneficiary with matching `amount_phpc = amount_php` and a non-null, non-empty `onchain_tx_hash`.
3. Return `true` if updated, or `false` if ownership or proof is missing. A repeat with matching issued proof returns `true`.

No release API exists.
No expiry API exists.
No takeover API exists.

### Ledger view and DTO

`fund_ledger_summary` appends two columns:
- `backed_grants_php`: sum of `amount_php` across all reservations (`RESERVED` and `ISSUED`).
- `available_to_grant_php`: net completed contributions minus `backed_grants_php`.

DTO fields in `FundLedgerDto` are `backedGrantsPhp` and `availableToGrantPhp` (exact decimal strings).
Previous column meanings remain identical:
- `gross_contributions_php`: gross completed contributions.
- `fees_php`: PayPal fees on completed contributions.
- `net_contributions_php`: net completed contributions.
- `grants_issued_php`: all grants with an on-chain transaction hash. Legacy grants issued before migration 00020 remain in this total, but do not debit `available_to_grant_php`.
- `confirmed_sales_php`: confirmed food sales.
- `paid_invoices_php`: total of paid settlement invoices.
- `owed_php`: `confirmed_sales_php - paid_invoices_php`. This is the program obligation for unpaid confirmed sales, not cash.

No second gate exists on invoices.
No journal duplication exists.

## 3. Allocation flow and failure retention

The allocation flow in `BeneficiaryService.allocateTierCredits`:
1. Verify beneficiary existence and a valid intervention tier (Tier 1 = PHP 5,000.00 / 5,000 PHPC; Tier 2 = PHP 3,500.00 / 3,500 PHPC).
2. Verify that no prior allocation exists in `allocations`.
3. Generate a fresh server-side `attemptId = randomUUID()`.
4. Call `FundRepository.reserveGrant(beneficiaryId, attemptId, amountPhp)`.
   - `insufficient`: return `ValidationError` specifying needed and available PHP amounts.
   - `busy`: return `ValidationError` stating that an unresolved reservation requires operator review. Never submit to chain.
   - `issued`: return `ValidationError` stating duplicate allocation.
   - Any failure or error: stop immediately.
5. Only `acquired` proceeds:
   - Check beneficiary custodial wallet and authorized PHPC trustline.
   - Submit transfer on Stellar testnet and wait for confirmation.
   - Update `beneficiaries.credit_balance`.
   - Insert `allocations` record with transaction hash and ledger sequence.
   - Call `FundRepository.markGrantIssued(beneficiaryId, attemptId)`. If false or error, return `PersistenceError`.

### Why no automatic recovery

The Stellar SDK client cannot distinguish a network timeout from an accepted on-chain transaction.
Existing database updates for credit balance and allocation records are not atomic.
If the system attempted automatic release after an error or timeout, funds could be freed while a transfer succeeded on-chain, creating an unbacked grant.

Therefore, **all failures retain the reservation**:
- Missing wallet or configuration errors.
- Trustline verification errors.
- Stellar submission errors or timeouts.
- Thrown runtime exceptions.
- Balance update failures.
- Allocation insert failures.
- Finalization errors or lost RPC responses.

Manual operator recovery:
1. An operator must stop all workers for that beneficiary.
2. The operator must inspect the Stellar network to confirm whether any transfer occurred.
3. The operator must inspect the exact `attempt_id` under the fund advisory lock `(1111576148, 1)`.
4. If proof of non-payment is absent, the operator must retain the reservation.
5. If payment occurred with partial database updates, the operator must reconcile the database. The operator must never call the grant endpoint again to repair a partial write.

## 4. Program and payment boundaries

- **PayPal role**: PayPal is the funding prerequisite. Captured PayPal money provides verifiable program funding. It does not act as an escrow agent and does not guarantee bank money.
- **AI role**: Gemini vision identifies food items at the store counter. Server rules decide food eligibility. The system does not assert statistics on cash misuse frequency, named partner endorsements, or guaranteed nutrition results.
- **Single program account**: All contributions land in one program PayPal business account.
- **Store payout boundary**: Stores do not need a PayPal account. A paid settlement invoice marks an approved claim between the store and the program. Final local payout to the store is handled separately by the program on local rails and is not proved by a paid PayPal invoice.

## 5. Sources read

- [Create order](https://developer.paypal.com/api/orders/v2/orders-create)
- [Capture order](https://developer.paypal.com/api/orders/v2/orders-capture)
- [Get order](https://developer.paypal.com/api/orders/v2/orders-get)
