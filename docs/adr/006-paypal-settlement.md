# ADR 006: PayPal sandbox settlement

Status: accepted for the first phase in `docs/designs/paypal-settlement.md`.

## Problem

The server records sales and credits the merchant. It needs a separate payment record.
PayPal calls can fail after PayPal accepts a request. Two users can also act at the same time.

## Decision

Use PayPal Invoicing v2 in the sandbox. Use the installed `fetch` API. Add no dependency.
An administrator must approve each proposal. The model cannot execute a PayPal call.

Add two settlement tables. Enable RLS. Add no client policy. Permit only the service role to
read the new views or execute the new functions. Keep all existing policies and balance paths.

SQL selects sales and computes each total. A partial unique index reserves each sale that is
not held. Keep that reservation after payment. Cancellation makes every line held and sets the
payable total to zero. A second partial unique index permits one active invoice per merchant.
Each write function uses the same transaction lock for that merchant. Approval and cancellation
also lock the invoice row.

The proposal function takes `p_sale_ids` in addition to the three original arguments. This list
contains only sales that the server reviewed. A sale that arrives during review waits for the
next proposal. Select at most 100 sales, oldest first. PayPal permits at most 100 invoice items.
Four views expose sale proof, invoice totals, eligible sales and merchant totals. They convert
numeric amounts to text in SQL. TypeScript formats individual amounts but computes no totals.

The first approval fixes the released lines and total. A repeat cannot release another line.
An approved proposal cannot be rejected. Its remote draft can already exist after a timeout.
This restriction prevents a second proposal from claiming a sale with an active remote invoice.

Use fixed request keys for create and send. Use a fixed invoice number as another duplicate
guard. Save the remote draft ID before send. Check the remote ID, reference, PHP currency and
total before send and on refresh. Read the payer URL from `detail.metadata.recipient_view_url`.
Accept only sandbox payer URLs. Never follow a redirect when a request carries credentials.
The token cache refreshes 60 seconds before expiry. Each HTTP request has a 15-second timeout.
Return a `paypal` error with HTTP 502. Do not expose the remote response body or error text.

Do not send a request key on the OAuth token call. Request the invoice representation on draft
creation. Accept resource links from the two sandbox API origins, but send all requests to
`api-m.sandbox.paypal.com`. Send only remote drafts. Recover a missing payer URL on a later
refresh or repeat approval. Keep an existing payer URL when PayPal omits it on payment.

Use the product with the same exact name as the first price reference. Otherwise, use the
existing market price search. Compare decimal prices with integer arithmetic before display
rounding. The model can explain an enforced hold. It can add a hold only when a reference is
missing. It cannot add a sale, release an enforced hold, or change an amount. Reject unknown
model IDs. Use a fixed summary after a model failure, invalid response or 15-second deadline.
The underlying model request can finish later. It cannot change the saved proposal.

Only PayPal status `PAID` marks an invoice paid. A partial payment or `MARKED_AS_PAID` does not.
Keep local payment state unchanged for remote cancellations and refunds. Such cases need an
operator review. This phase has no remote cancellation or refund flow.

## Limits and trade-offs

One sandbox business account invoices for every store. This is a hackathon shortcut. Payment
goes to that sandbox account. This does not prove payment to a separate merchant account.
Add store onboarding before use with separate accounts. This phase does not support live funds.

If draft creation succeeds but its response or local save fails, repeat the same approval.
The fixed request key and invoice number prevent a different draft. If PayPal cannot replay the
response, an operator must find the draft in the sandbox and reconcile its ID. Do not reject
the approved proposal or make a new invoice to bypass this state.

The held total on a cancelled invoice includes all its lines. Its payable total is zero.
Merchant totals can span many invoices. Each total must fit `NUMERIC(12,2)`.
There is no fund top-up, payout, webhook, or change to Stellar settlement in this phase.

## Sources read

Read with Grounded Docs on 2026-11-12. The old `/docs/api` path redirects to the new reference.

- [Invoicing v2 index](https://developer.paypal.com/docs/api/invoicing/v2/).
- [Create draft invoice](https://developer.paypal.com/api/invoicing/v2/invoices-create).
  Read the item fields, 100-item limit, reference, recipient, currency and amount fields.
- [Send invoice](https://developer.paypal.com/api/invoicing/v2/invoices-send).
  Read the notification fields and the rule that a repeated send has no effect.
- [Show invoice details](https://developer.paypal.com/api/invoicing/v2/invoices-get).
  Read the payer URL, amount, reference and status response fields.
- [Invoice status](https://developer.paypal.com/api/invoicing/v2/definitions/invoice_status).
  Read the difference between `PAID` and `MARKED_AS_PAID`.

The gateway accepts a draft ID or a sandbox resource link. Send can return an empty body or a
link. The gateway reads the full invoice after send. These shapes are checked against the pages
above and fake HTTP responses. They have not been checked with a live sandbox account.

Review on 2026-11-12 also read the official Invoicing v2 OpenAPI schema. Its create response
description supports `Prefer: return=representation`. The send page says that a repeated send
has no effect. This differs from the review claim that a repeated send can be rejected. The
service still sends only a `DRAFT` and syncs an invoice that PayPal already sent.
The current reference does not confirm the alternate `api.sandbox.paypal.com` response origin.
Accept it only for ID extraction as required by the review. Never send credentials to that URL.
The official Authentication page shows the token call without a request ID.

- [Invoicing v2 OpenAPI schema](https://developer.paypal.com/api/invoicing/v2/schema.json).
- [Authentication](https://developer.paypal.com/api/rest/authentication).

## Verification

Unit tests use fake HTTP responses, repositories and model calls. Route tests use the mounted
application with its existing role middleware. They check input validation and merchant scope.
The DTO snapshot records the proof shape and the `approved` field. SQL tests inspect constraints,
locks, totals and grants. Live checks passed for role grants and concurrent proposals. The
owner's project has migration 00018 applied. Sandbox checks covered review, approval, sending,
payment and merchant status refresh.
