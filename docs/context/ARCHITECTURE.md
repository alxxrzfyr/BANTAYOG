# Architecture

This guide describes the current source. The [ADRs](../adr/) record decisions, and the
[archive](../archive/README.md) keeps completed instructions and older snapshots.
Planned Rural features are not claims about the current build.

## Application boundaries

| Component | Responsibility |
| --- | --- |
| `apps/web` | Next.js 16 interface for administrators, merchants, funders, and the read-only guardian balance page. It calls the API and does not authorize grants or purchases. |
| `apps/server` | Hono API with routes, services, repositories, and pure domain rules. It owns eligibility, tiers, funding checks, payment review, and chain operations. |
| `packages/schema` | Shared request and response validation. |
| `packages/db` | Supabase types, clients, and repositories. Check types against migrations before a database change. |
| `supabase/migrations` | Append-only database changes, constraints, and transactional money operations. |

The web app runs on port 3000 and the API on port 3001 during local development. The web proxy
forwards requests; it is not a second backend. The PWA uses Serwist and a static offline page.
API requests and requests with Authorization headers use the network rather than the cache.

There is no `apps/mobile` package or `build:mobile` script in this checkout. The README links
to a separately published debug APK. Bundled merchant exports and Urban/Rural variants remain
separate packaging work in the [handoff](../handoff/MERCHANT_APK_HANDOFF.md) and Rural plan.

## Server layers

Requests pass through CORS, logging, rate limits, and the route's authentication and role checks.

1. Routes parse input with shared Zod schemas and map errors to HTTP responses.
2. Services coordinate operations and return `AppResult` values for expected failures.
3. Repositories read and write records through the Supabase service client.
4. Domain functions hold pure policy rules and take an explicit date when needed.
5. `src/dto/mappers.ts` translates database rows into public DTOs.

Keep tier and nutrition policy in `apps/server/src/domain`. The unused web policy copies and
the test-only state machine were removed. Database status and worker results describe real
transactions; a separate simulated lifecycle is not part of request processing.

## Registration and grants

An administrator registers a guardian and child. The server hashes the guardian PIN, creates
the custodial Stellar account, computes the tier, and signs the printed Nutri-Pass.
Tier 1 receives 5,000 credits and Tier 2 receives 3,500 credits. Each child gets one grant.

New grants also require captured PayPal funding:

1. The server checks the beneficiary and derives the amount from age.
2. `reserve_grant_funding` locks funding allocation and checks net completed contributions.
3. Only an acquired reservation permits the Stellar transfer.
4. The server records the confirmed allocation and calls `mark_grant_funded`.

An unresolved attempt retains its reservation until operator review. The current balance and
allocation writes are not one atomic cross-system operation. Do not retry the grant endpoint
to repair partial success. Use the [fund contract](../designs/paypal-fund.md) and
[ADR 008](../adr/008-fund-backed-grants.md) for recovery rules.

## Checkout and ledger settlement

Checkout checks merchant approval, the signed pass, pass revocation and expiry, beneficiary
status, guardian PIN, a positive total, and sufficient credits.

The route calls `settle_sale_and_enqueue`. This database function wraps `settle_sale` and keeps
credit deduction, merchant audit credit, receipt creation, the `PENDING_CHAIN` status, and the
outbox event in one transaction. The request UUID is also the transaction ID, so a repeated
checkout cannot create a second purchase with that ID.

The route currently constructs its response in memory. A timestamp in that pending response is
not proof of chain confirmation; use the stored transaction and ledger reference for proof.

The reconcile worker reads up to 100 pending events. It first attempts a batch payment and can
fall back to serial processing. Custodial beneficiary accounts sign payments to merchant
accounts, and the sponsor covers fees. Successful settlement records the hash and ledger
sequence. Failed submissions follow the worker's retry and audit behavior.

The merchant profile reads the custodial account's live PHPC balance from Horizon as an exact
decimal string. The database's `merchants.wallet_balance` is a separate audit record.
Wallet login, wallet connection, and cash-out mutations are retired; old modal code is not a
current payment path.

## Product recognition and eligibility

Gemini helps identify products and estimate prices. Server services read catalog and market
reference data before returning results. Non-branded price review keeps reference units,
measured weight, and nutrition review separate; a missing weight must not become a nutrition
rejection.

The current scan path can create a catalog row from a model result. It is not the signed,
strictly catalog-backed Rural validator. The Rural design requires explicit approved catalog
releases and must not treat an unknown product as authorized. Keep this distinction when
describing or extending the scanner.

## PayPal contributions and store claims

PayPal Orders v2 creates and captures sandbox contributions. The server checks the saved order,
currency, amount, capture status, fees, and net amount. SQL prevents reuse of the same capture.

For store claims, server price rules and Gemini prepare a review. An officer approves the
released sales before the server creates and sends a PayPal Invoicing v2 invoice. Only remote
`PAID` status marks the invoice paid. Database constraints prevent duplicate claims.

Contributions back grants but do not automatically pay invoices from a pooled balance. Invoice
payments go to one program sandbox account, not directly to stores. A local store payout is
separate and is not proved by a paid invoice. The [payment contracts](../designs/) define these
boundaries; the [verification record](../paypal-hackathon/verification.md) records checks that ran.

## Security and exact amounts

- Supabase authentication and route ownership checks protect administrator and merchant data.
- The balance page is public, read-only, and authorized by the signed QR token.
- Guardian PINs use Argon2id. Configured Redis controls apply the five-failure lockout.
- Custodial keys use AES-256-GCM at rest. Chain configuration goes through `loadChainConfig`.
- PHP columns use `NUMERIC(12,2)`; chain amounts use integer stroops. One PHPC is 10,000,000 stroops.
- Secrets, private keys, PINs, and beneficiary data must not appear in logs or documentation.
- DTO snapshots remain the API contract. Type declarations do not replace migration review.

See the [security policy](../SECURITY.md) for configuration and payment controls. This cleanup
does not change authentication, RLS, migrations, or settlement behavior.

## Planned Rural extension

The [Rural ADR](../adr/004-rural-offline-quota-authorization.md),
[design](../superpowers/specs/2026-08-04-offline-product-validation-and-transactions-design.md),
and [plan](../superpowers/plans/2026-08-04-rural-offline-merchant-flow.md) remain active and unfinished.
They require assigned beneficiaries, bounded permits, separate signing keys, a local event
queue, and server-validated synchronization. The [open security reviews](../handoff/reviews/)
are execution gates, not completed work. Do not treat the offline fallback page as offline payment.

## Adding a feature

Extend shared schemas, pure server rules, services, repositories, and routes in that order.
Map DTO changes in one place and update their snapshots deliberately. Add regression tests for
behavior changes. New migrations are append-only and require matching database types and tests.
Run lint, type checks, and the affected tests, and obtain approval for protected changes listed
in `AGENTS.md` before implementation.
