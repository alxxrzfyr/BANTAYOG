# PayPal settlement: build contract

Status: approved for build on branch `feat/paypal-hackathon`. This file is the contract between
the server work and the web work. If the code must differ from this file, change this file in the
same commit.

## 1. What this feature does

BANTAYOG records a sale and credits the merchant. It has no step that pays the merchant. This
feature adds that step with PayPal Invoicing (sandbox only).

1. The store owner taps "Get paid".
2. The server collects the final, unpaid sales of that merchant and makes a settlement proposal.
3. A price check holds each sale that has an item above its reference price. Gemini writes the
   summary and the reason for each held sale.
4. The program officer (role `admin`) reads the proposal and the proof for each sale, then
   approves.
5. The server creates and sends a PayPal invoice. The officer pays it in PayPal.
6. The server reads the invoice status from PayPal. The store owner sees "Paid".

Rule: the model proposes, server rules fix the totals, a person approves, PayPal executes.

## 2. Scope

In scope: sections 3 to 7 of this file.

Not in scope (do not build): PayPal Payouts, webhooks, onboarding of many stores, a change to
`settle_sale`, `settle_sale_and_enqueue`, `credit_balance` or `merchants.wallet_balance`, a public
proof page, a chat feature, a new production dependency.

## 3. Data (migration `00018_paypal_settlement.sql`)

New tables only. Enable RLS on each table and add no client policy: the server uses the service
role. Mirror the tables in `packages/db/src/types.ts` and `types.test.ts`.

`settlement_invoices`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | UUID PK | default `gen_random_uuid()` |
| `merchant_id` | UUID FK `merchants(id)` | not null |
| `status` | TEXT | `PROPOSED`, `SENT`, `PAID`, `CANCELLED` |
| `total_amount_php` | NUMERIC(12,2) | sum of the lines that are not held |
| `ai_summary` | TEXT | not null, can be the fallback text |
| `paypal_invoice_id` | TEXT | unique, null until the remote draft ID is saved |
| `paypal_invoice_url` | TEXT | payer link from PayPal, null until sent |
| `approved_by` | UUID | admin user id, null until approved |
| `created_at`, `sent_at`, `paid_at` | TIMESTAMPTZ | |

Partial unique index: one invoice with status `PROPOSED` or `SENT` for each merchant.

`settlement_invoice_lines`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | UUID PK | |
| `invoice_id` | UUID FK `settlement_invoices(id)` | on delete cascade |
| `transaction_id` | UUID FK `transactions(id)` | |
| `amount_php` | NUMERIC(12,2) | copy of `transactions.total_amount` |
| `held` | BOOLEAN | default false |
| `hold_reason` | TEXT | null if not held |

Partial unique index on `transaction_id` where `held = false`: a sale can have one released
settlement line only. Keep this reservation after payment. A hold or cancellation frees it.
This index is the duplicate guard. Do not replace it with a check in TypeScript.

Postgres functions (all the multi-row writes are in SQL, in one transaction each):

- `create_settlement_proposal(p_merchant_id, p_held jsonb, p_ai_summary, p_sale_ids uuid[])`: selects the eligible
  sales, inserts the invoice and its lines, computes `total_amount_php` in SQL. `p_held` is a list
  of `{transactionId, reason}`. `p_sale_ids` fixes the reviewed sale set. Sales that arrive during
  review wait for the next proposal. Return `{ id, created }`. Limit each proposal to 100 sales,
  oldest first. PayPal permits at most 100 invoice items.
- `approve_settlement(p_invoice_id, p_admin_id, p_release uuid[])`: sets `held = false` for the
  released lines, recomputes the total, records `approved_by`. Status stays `PROPOSED` until the
  PayPal send succeeds.
  The first approval fixes the released lines and total. A repeat cannot release another line.
- `cancel_settlement(p_invoice_id, p_reason)`: status `CANCELLED`, all lines `held = true`.
  Set the payable total to zero. Only an unapproved proposal can be cancelled. An approved
  proposal can already have a remote draft after a timeout. Retry approval or reconcile the draft.

The write functions use one shared transaction lock per merchant. Approval and cancellation
also lock the invoice row. Four service-only views expose eligible sales, invoice totals, line
proof and merchant totals. They use `security_invoker = true` and have no client grants. All
totals are computed in SQL. Each view returns money as text. No existing RLS policy changes.

Eligible sale: `transactions.merchant_id` = the merchant, `status` in (`CONFIRMED`,
`RECONCILED`), and no line with `held = false` exists for it. Sales with status `PENDING_CHAIN`
or `SUBMITTED` are counted as "waiting for ledger confirmation" and are not invoiced.

## 4. PayPal

- Config loader `apps/server/src/lib/paypal/config.ts`, same pattern as `lib/chain/config.ts`,
  returns `AppResult`. Variables: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
  `PAYPAL_PROGRAM_PAYER_EMAIL`, optional `PAYPAL_API_BASE`. The loader accepts only the host
  `api-m.sandbox.paypal.com`. Any other host is an error.
- Add the variables to `turbo.json#globalEnv`, the `.env.example` files and
  `apps/server/src/types/env.ts`. Add the secret to `collectConfiguredSecrets`.
- Gateway `apps/server/src/gateways/paypal.gateway.ts`, `fetch` only. Operations: get token
  (cache it until 60 seconds before expiry), create draft invoice, send invoice, get invoice.
  Send deterministic `PayPal-Request-Id` values on invoice create and send only. Do not send this
  header on the OAuth token request. Use the settlement invoice id as the base of the key.
  Draft creation sends `Prefer: return=representation`. A response resource link can use either
  sandbox origin: `https://api-m.sandbox.paypal.com` or `https://api.sandbox.paypal.com`.
  Extract and validate the `INV2-...` ID. Never call the response link.
- Read the official Invoicing v2 documentation before you write the calls. Each documentation page
  has a Markdown version: add `.md` to the URL. Start at
  `https://developer.paypal.com/docs/api/invoicing/v2/`.
- One PayPal invoice item for each sale that is not held. Amount = `amount_php` as a string with
  2 decimals, currency `PHP`, quantity 1. Name: `Sale <first 8 characters of the id>`. Description:
  the item names and the sale date.
- `detail.reference` = the settlement invoice id.
- Hackathon shortcut: one sandbox business account is the invoicer for every store. Mark it in
  code with `shortcut:` and state it in `apps/server/README.md`. Payment goes to that sandbox
  account. This does not prove payment to a separate merchant account.
- Never log or return the client secret or the access token. Use `redactSecrets` around calls.
- Save the remote draft ID before send. Check the remote ID, reference, PHP currency and total
  before send and on refresh. Use a fixed invoice number in addition to the POST request keys.
  Read the payer URL from `detail.metadata.recipient_view_url`. Accept only sandbox payer URLs.
  Each HTTP request has a 15-second timeout. Do not follow redirects with credentials.
- Only remote status `PAID` marks an invoice paid. `MARKED_AS_PAID` and partial payments do not.
  Remote cancellations and refunds need operator review. This phase has no cancellation or
  refund flow in PayPal. A PayPal failure returns the `paypal` error tag with HTTP 502.
- Approval sends only a remote `DRAFT`. An invoice that was already sent proceeds to status sync.
  A `SENT` invoice with no payer URL can get that URL on refresh or repeat approval. Keep its
  original send time. A paid response with no URL must keep a saved URL. Approval can return a
  `PAID` invoice without a URL.

## 5. Proposal and price check

- A sale is held if an item has `unitPricePhp` above its reference price. Reference: the
  `products` row with the same name (`price_range_max`), else `searchMarketPrice(name)`.
- If an item has no reference, Gemini judges the price. Gemini can hold a sale. Gemini cannot add
  a sale, remove a sale that is not held, or change an amount.
- Gemini writes `ai_summary` and each `hold_reason` through `callGeminiWithFallback` with a
  response schema. The server drops each transaction id that is not in the eligible set.
- A Gemini failure is an expected failure. Use a fixed fallback text and continue. Never block a
  payment on the model.
  Use the same fallback for an invalid response or a 15-second deadline. Compare full stored
  unit prices before rounding for display. Product name matching is exact. The model can add
  a hold only if a price reference is missing. It cannot release a hold enforced by the server.

## 6. API

All money values are strings with 2 decimals. DTOs are camelCase and are mapped in
`src/dto/mappers.ts`. Zod schemas are in `@bantayog/schema`.

```ts
type SettlementStatus = 'PROPOSED' | 'SENT' | 'PAID' | 'CANCELLED'

interface SettlementLineDto {
  transactionId: string
  amountPhp: string
  soldAt: string            // ISO time of the sale
  held: boolean
  holdReason: string | null
  ledgerTxHash: string | null
  items: { name: string; category: string; quantity: number; unitPricePhp: string; imageUrl: string | null }[]
}

interface SettlementInvoiceDto {
  id: string
  merchantId: string
  storeName: string
  status: SettlementStatus
  approved: boolean          // true when approved_by is not null, even before draft creation
  totalAmountPhp: string
  heldAmountPhp: string
  aiSummary: string
  paypalInvoiceId: string | null
  payUrl: string | null
  createdAt: string
  sentAt: string | null
  paidAt: string | null
  lines?: SettlementLineDto[]   // present on detail responses only
}

interface MerchantSettlementOverviewDto {
  unpaidSaleCount: number
  unpaidAmountPhp: string
  waitingForLedgerCount: number
  paidAmountPhp: string
  invoices: SettlementInvoiceDto[]   // newest first, no lines
}
```

Merchant routes (role `merchant`, the merchant comes from the token, never from the request):

| Method and path | Result |
| --- | --- |
| `GET /api/merchants/me/settlements` | `MerchantSettlementOverviewDto` |
| `POST /api/merchants/me/settlements` | 201 `SettlementInvoiceDto` with lines. If a `PROPOSED` or `SENT` invoice exists, 200 with that invoice. If no eligible sale exists, validation error |
| `GET /api/merchants/me/settlements/:id` | `SettlementInvoiceDto` with lines, own invoices only |
| `POST /api/merchants/me/settlements/:id/refresh` | reads PayPal, returns the invoice |

Admin routes (role `admin`):

| Method and path | Result |
| --- | --- |
| `GET /api/settlements?status=` | `SettlementInvoiceDto[]` |
| `GET /api/settlements/:id` | `SettlementInvoiceDto` with lines |
| `POST /api/settlements/:id/approve` body `{ releaseTransactionIds?: string[] }` | Approve, create and send the PayPal invoice. Return `SENT` with `payUrl`, or `PAID` if PayPal already reports payment. A paid invoice needs no URL. Safe to repeat |
| `POST /api/settlements/:id/reject` body `{ reason: string }` | status `CANCELLED` |
| `POST /api/settlements/:id/refresh` | reads PayPal, sets `PAID` if PayPal reports the invoice as paid |

The line DTO has no beneficiary name, no PIN and no key.

## 7. Web

The current design is the source of truth: `docs/context/DESIGN.md`, `apps/web/app/globals.css`
and the components in `apps/web/components`. No new color, font or brand element. No new
production dependency: use CSS for motion and respect `prefers-reduced-motion`.

- Merchant: a "Get paid" entry on the merchant dashboard and a page
  `apps/web/app/(merchant)/dashboard/settlements`. States: nothing to claim, sales waiting for
  ledger confirmation, proposal in progress, proposed (waits for the officer), sent (waits for
  payment), paid, held sales with their reason, error.
- Admin: `apps/web/app/admin/settlements` (list) and a detail view. The detail view shows the
  summary, each sale with its items, images, time and ledger hash, held sales with the reason and
  a release control, approve, reject, the PayPal pay link and a status refresh.
- Web code does no eligibility, total or price decision. It shows what the API returns.
- Web owns `apps/web` only. It does not edit `packages/*` or `apps/server`.

## 8. Second phase outline

- Table `fund_topups` with a unique `paypal_capture_id`.
- `POST /api/fund/topups` (create order), `POST /api/fund/topups/:orderId/capture` (server
  capture, amount and currency checked against the order).
- `GET /api/fund/ledger`: top-ups, grants issued, sales, invoices paid, amount still owed.
- One funder page and one ledger screen.

## 9. Done means

- `pnpm lint && pnpm type-check && pnpm test` pass.
- Each new service method has a test for the success path and for each `err(...)` path.
- A test proves that a second "Get paid" request does not invoice a sale two times.
- A test proves that the loader rejects a host that is not the sandbox host.
- The DTO snapshot is updated on purpose.
- An ADR in `docs/adr/` records the decision and its trade-offs.
