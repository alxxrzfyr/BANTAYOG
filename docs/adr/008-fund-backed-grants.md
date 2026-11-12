# ADR 008: Fund-backed grants and safe reservation retention

Status: implemented on `feat/paypal-hackathon`.

## Problem

BANTAYOG gave demonstration grants without checking whether captured funds existed.
A program must not promise money that it does not hold.
Also, two administrators can trigger grants at the same time.
A network timeout during a Stellar chain call cannot prove that a payment failed.
Database updates for beneficiary balance and allocation records are not atomic.
An automatic release after an error can release funds while a payment succeeded on the chain.

## Decision

Require completed PayPal captures before any new grant.
Add migration `00020_fund_backed_grants.sql`.
Add table `fund_grant_reservations`.
The table uses `beneficiary_id UUID PRIMARY KEY REFERENCES public.beneficiaries(id) ON DELETE RESTRICT`.
It stores `attempt_id UUID NOT NULL UNIQUE`, `amount_php NUMERIC(12,2) NOT NULL CHECK (amount_php IN (5000.00, 3500.00))`, `status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'ISSUED'))`, and `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
Enable Row-Level Security.
Revoke all table permissions from `PUBLIC`, `anon`, and `authenticated`.
Grant `SELECT` to `service_role`.
Writes occur only through two PL/pgSQL functions.
Keep existing authorization, RBAC, RLS policies, and `settle_sale` unchanged.

### Functions and locking

Provide two `SECURITY DEFINER` functions with fixed `search_path = public`:

1. `reserve_grant_funding(p_beneficiary_id UUID, p_attempt_id UUID, p_amount_php TEXT) RETURNS JSONB`
2. `mark_grant_funded(p_beneficiary_id UUID, p_attempt_id UUID) RETURNS BOOLEAN`

Both functions enforce `transaction_isolation = 'read committed'`.
Both functions take a fixed transaction advisory lock `(1111576148, 1)` in a separate statement before data reads.
This separate lock statement gives reads a fresh snapshot after any lock wait.

`reserve_grant_funding` rejects null parameters and amounts other than `'5000.00'` or `'3500.00'`.
If an allocation or an `ISSUED` reservation already exists, return `{ "outcome": "issued" }`.
If any reservation exists for the beneficiary, return `{ "outcome": "busy" }`.
This check blocks simultaneous and repeated attempts for the same beneficiary.
Compute available funds: the net sum of `COMPLETED` rows in `fund_topups` minus the sum of all rows in `fund_grant_reservations`.
PayPal fees are excluded from available funds.
Both `RESERVED` and `ISSUED` reservations reduce available funds.
If available funds are less than the requested amount, return `{ "outcome": "insufficient", "availablePhp": "<amount>" }`.
Otherwise, insert the reservation row and return `{ "outcome": "acquired" }`.
Only an `acquired` result permits chain submission.

`mark_grant_funded` takes the same advisory lock.
It sets `status = 'ISSUED'` only when `beneficiary_id` and `attempt_id` match, and an `allocations` record exists with the same amount and a non-empty `onchain_tx_hash`.
It returns `true` if updated, or `false` if ownership or proof is missing.
A repeat call with matching issued proof returns `true`.

There is no release API.
There is no expiry API.
There is no takeover API.

### Accounting and ledger view

Extend `fund_ledger_summary` with two columns:
- `backed_grants_php`: sum of all rows in `fund_grant_reservations`.
- `available_to_grant_php`: net contributions minus `backed_grants_php`.

DTO fields are `backedGrantsPhp` and `availableToGrantPhp`.
Existing columns keep their meanings:
- `gross_contributions_php`, `fees_php`, `net_contributions_php`.
- `grants_issued_php` still includes legacy demonstration grants.
- `owed_php` remains `confirmed_sales - paid_invoices`, not cash.

Allocations created before migration 00020 remain valid.
They do not reduce `available_to_grant_php`.
No second gate exists on invoices.
No journal duplication exists.

## Why no automatic recovery

The Stellar SDK wrapper cannot distinguish a network timeout from an accepted payment.
Database balance updates and allocation writes are not atomic.
If an automatic release runs after a timeout, the system can double-spend the pool.
Therefore, all failures retain the reservation:
- Missing wallet or configuration errors.
- Trustline check errors.
- Stellar submission errors or timeouts.
- Balance update errors.
- Allocation insert errors.
- Finalization errors.
- Lost RPC responses.

An operator must perform manual recovery:
1. Stop all workers for this beneficiary.
2. Verify on the Stellar network whether a transfer occurred.
3. Check the exact `attempt_id` under the fund advisory lock `(1111576148, 1)`.
4. If proof of non-payment is absent, retain the funding reservation.
5. If payment occurred with partial database records, reconcile the database. Never call the grant endpoint again to repair a partial write.

## Consequences

Every new grant requires captured PayPal funds.
No captured money means no new grant.
An officer sees clear refusal messages when funds are insufficient or when a grant attempt is busy.
Unresolved reservations stay covered until an operator reviews them.
The program business account holds captured funds; stores do not need PayPal accounts.
Local store payouts remain a separate operational step.

Sources: [Fund contract](../designs/paypal-fund.md) and [Settlement contract](../designs/paypal-settlement.md).
