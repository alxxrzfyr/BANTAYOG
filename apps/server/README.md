# Server: PayPal sandbox setup

Use the first phase in [the build contract](../../docs/designs/paypal-settlement.md).
Use [ADR 006](../../docs/adr/006-paypal-settlement.md) for the payment rules and failure limits.

Set these variables on the server:

| Variable | Value |
| --- | --- |
| `PAYPAL_CLIENT_ID` | Sandbox app client ID |
| `PAYPAL_CLIENT_SECRET` | Sandbox app secret |
| `PAYPAL_PROGRAM_PAYER_EMAIL` | Sandbox payer account email |
| `PAYPAL_API_BASE` | Optional. Default: `https://api-m.sandbox.paypal.com` |
| `GEMINI_API_KEY` or `GEMINI_API_KEYS` | Model key, or comma-separated keys. Without a key, proposals use the fixed summary |

The server also needs its existing Supabase and authentication variables. Use the root or server
`.env.example` as the variable list. Set a dedicated private `QR_TOKEN_SECRET` and a private
`CUSTODIAL_KEY_ENCRYPTION_KEY`. Keep credentials out of the repository and browser.

Apply migration `00018_paypal_settlement.sql` only after database review and owner approval.
This migration adds new objects only. Never edit or replay a migration that is already applied.

Shortcut: one sandbox business account invoices for every store. Payment goes to that account.
This does not prove payment to a separate merchant account. Add store onboarding before that use.
Only the sandbox API host is accepted. No live PayPal payment is supported.

The merchant requests a proposal at `POST /api/merchants/me/settlements`. The administrator
approves it at `POST /api/settlements/:id/approve` with `{}` or released transaction IDs. Read
`payUrl` from the result. Pay through that sandbox link. Use the invoice refresh route to read
the payment status. Only PayPal status `PAID` marks the invoice paid.

Retry the same invoice after a network or persistence failure. Approval fixes the line set.
An approved proposal cannot be rejected. A draft can already exist in PayPal after a timeout.
If PayPal cannot replay draft creation, reconcile the remote draft ID before further action.

Run `pnpm --filter @bantayog/server test`, `lint` and `type-check` from the repository root.
Tests use fake HTTP responses. They require no PayPal secret or database.

## Limits

An approved invoice whose PayPal send keeps failing cannot be rejected and needs an operator.
