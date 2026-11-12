# PayPal fund: build contract

This is phase 2 of [the settlement build](paypal-settlement.md). The invoice flow passed its
live sandbox check on November 12, 2026. PayPal invoice `INV2-4H7T-DMAM-TJNV-R64S` was paid for
PHP 50.00. BANTAYOG read `PAID`. A second claim returned no eligible sale.

## Behavior

- `/fund` lets a funder approve a sandbox contribution in PayPal. The server creates and captures
  an Orders v2 order. The return page never treats a redirect as payment proof.
- The contribution is PHP 1.00 to PHP 100,000.00. Amounts use strings with two decimal places.
- A client request UUID fixes one amount and one order. A changed amount needs a new request.
- Before capture, the server reads the saved order and checks its ID, `CAPTURE` intent,
  reference, PHP currency and amount. Only an approved order can be captured.
- After capture, the server reads the order again. One final `COMPLETED` capture must match the
  stored amount. Gross, PayPal fee and net must use PHP. SQL checks `gross = fee + net`.
- A retry reads a completed order and records the same capture. It never creates a second
  deposit. The database has unique order and capture IDs. No payer name or email is stored.
- `/admin/fund` shows gross contributions, fees, net contributions, issued grants, confirmed
  food sales, paid invoice totals and the amount still owed for confirmed sales. SQL computes
  every total. Recent contributions show gross, fee and net as separate values.

The equation is `confirmed food sales - paid invoice totals = amount still owed`.
Contributions, grants and invoice payments are separate records. This phase does not allocate
a contribution to a child or use a contribution to pay an invoice. It does not claim a bank
balance or prove that one contribution bought a specific item. It does not change credits,
merchant balances, existing settlement functions or existing access policies.

## Access and storage

Create and capture are public sandbox endpoints. Capture can act only on an order that this
server created and saved. PayPal requires buyer approval. Ledger access requires the existing
admin role. The public receipt contains no payer or child information.

Migration `00019_paypal_fund.sql` adds one service-only table, two views and two functions.
No client grants or policies are added. Mirror it in database types and type tests.
Use the existing gateway, errors, DTO mapper and route patterns. Add no dependency.

Return and cancel URLs use the first configured `CORS_ORIGIN` (localhost in development).
Require an HTTPS origin, except for local development. Never take a return URL from a request.
All PayPal requests and approval links use the sandbox. Checkout links require the exact
`www.sandbox.paypal.com` host, no credentials or port, and the saved order token.

## Proof

Test invalid amounts, changed request amounts, repeated create and capture, unapproved orders,
wrong references, currency, amount and capture count, non-final or pending captures, fees,
database failures and PayPal failures. Run live SQL checks with rollback fixtures. Complete one
real sandbox checkout and verify the ledger. Keep all existing tests green.

## Sources read

- [Create order](https://developer.paypal.com/api/orders/v2/orders-create)
- [Capture order](https://developer.paypal.com/api/orders/v2/orders-capture)
- [Get order](https://developer.paypal.com/api/orders/v2/orders-get)

The capture response can omit order intent and purchase-unit amount. After capture, read the
order to check the full proof. Send `Prefer: return=representation` and deterministic request
IDs on create and capture. Never read or follow a response API link.
