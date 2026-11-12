# ADR 007: Separate sandbox contributions from credits and invoice payments

Status: implemented on `feat/paypal-hackathon`.

## Decision

Use PayPal Orders v2 for public sandbox checkout. Use the existing gateway, config loader,
repository, service and DTO patterns. Add no dependency or payer profile. The existing admin
role protects the fund ledger. New tables, views and functions are service-only.

The request UUID fixes one amount. The server stores the order ID before it exposes checkout.
Before capture, read the saved order and check the reference, intent, PHP currency and amount.
After capture, read the order again, because a capture response can omit those order fields.
Accept one final completed capture only. SQL locks the contribution row, checks the fee equation
and enforces unique order and capture IDs. A retry can recover a completed remote payment after
a lost response. It cannot record a second deposit for that capture.

Use the first configured CORS origin for return and cancel URLs. Do not accept browser-supplied
URLs. API calls use the fixed sandbox host. Checkout links require the exact sandbox host and
the matching order token. Create and capture use distinct deterministic request IDs and request
the full representation. No OAuth request ID is sent. Public bodies have a 1 KiB limit.

## Accounting boundary

A contribution is not a child grant or an invoice payment. This build has no allocation from a
contribution to a beneficiary and no payment from a pooled contribution balance. The ledger
shows those records separately. It reports gross, fee and net contributions, issued grants with
a recorded ledger transaction, confirmed food sales and paid invoice gross amounts.

The amount still owed is confirmed sales minus paid invoices. It is not available cash. The
existing one-business-account invoice shortcut remains. No separate merchant payout is proved.
Refunds and disputes need operator review; this build does not reconcile them.

## Consequences

The public receipt contains no payer or child information. A cancelled return never confirms a
payment. An interrupted capture requires a retry of the same order. The browser keeps the
request UUID and amount before starting checkout. These controls keep a network failure from
turning into a second contribution.

This scope gives a working contribution path without changing credits, `settle_sale`, existing
RLS policies or merchant balances. Linking fund receipts to child grants requires a separate
allocation design and review.

Source: [fund contract](../designs/paypal-fund.md).
