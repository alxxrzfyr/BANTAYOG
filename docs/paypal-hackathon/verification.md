# PayPal build verification

Observed locally on November 12, 2026. All payments used PayPal sandbox test funds.
No live payment or hosted application deployment was made. The additive migrations were
applied to the owner's Supabase project after the rollback checks.

## Invoice flow

- A synthetic merchant submitted one confirmed rice sale for PHP 50.00.
- Real Gemini review held it because it had no reference price. The model wrote the summary.
- The test officer released the held test sale and approved it in the admin page.
- BANTAYOG created and sent one sandbox invoice.
- PayPal guest checkout confirmed PHP 50.00 paid. The invoice then showed PHP 0.00 due.
- The merchant used the BANTAYOG refresh control. It showed `PAID`, PHP 50.00 paid, zero unpaid
  sales and one invoice. A second claim returned HTTP 400 with no eligible unpaid sale.

## Funder checkout

- The public form rejected PHP 0.00. A double click on PHP 50.00 created one order.
- PayPal cancel-and-return worked. Retrying resumed the same order.
- Guest checkout returned to BANTAYOG. The server captured and checked the order.
- One capture completed: gross PHP 50.00, fee PHP 16.95, net PHP 33.05.
- Two concurrent repeat capture requests returned the same completed receipt and capture ID.
- Anonymous ledger access returned 401. A valid admin session returned 200.
- The admin ledger showed one contribution, the same gross, fee and net, and
  PHP 454.00 confirmed sales minus PHP 50.00 paid invoices equals PHP 404.00 owed.

The fee is an observed sandbox value. It is not a price quote for live PayPal use.

## Database and access checks

The invoice SQL checks passed for duplicate proposals, fixed approval, held-sale release and
rejection rules. Two concurrent proposal RPCs created one claim. Only the owned unapproved
test claim was removed. No credit balance changed.

The fund migration and contract checks ran in one transaction with rollback first. Checks
passed for fixed request amounts, invalid amounts, saved-order proof, exact fee totals,
repeat capture and unique capture use. All test rows rolled back. Existing child credits and
merchant balances stayed unchanged. The final additive migration was then applied.

The new tables have RLS enabled. `anon` and `authenticated` have no read grant. The service role
can read the service views. No existing policy or credit function changed.

## Automated and browser checks

The full checks passed: `pnpm lint --concurrency=1`, `pnpm type-check --concurrency=1`, and
`pnpm run test --concurrency=1`: schema 106, database 19, server 435 and web 197 tests (757 total).
The DTO snapshot includes the new contribution receipt on purpose.
Four local PostgreSQL tests also check fresh setup, catalog seeding, repeat-install refusal,
denied public reads and full rollback after a late error. They use minimal Supabase Auth and
Storage schemas. A new hosted Supabase deployment was not tested.
The production build also passed with `pnpm run build --concurrency=1` (four tasks).

Brave checks covered invoice review and release, PayPal payment, status refresh, funder input
validation, cancel, resume, capture, receipt and admin ledger. At 390 CSS pixels, merchant and
funder pages had no horizontal overflow. The merchant status button was 52 pixels high.
The paid merchant page also fit 320 CSS pixels. At 1440 CSS pixels, the admin ledger had no
horizontal overflow. Regression tests require network-only API and authenticated requests,
and require the API `no-store` response header.
The production service worker controlled the pages. Admin ledger requests returned HTTP 200
with `Cache-Control: no-store` through both the API and the web proxy. The browser cache held
no API or Authorization-bearing request after the ledger request. The production funder page
kept the existing brand colors and fit 390 CSS pixels.

## Remaining checks and limits

- Android QA could not run. The device tool reported no Android devices on the local host.
- Independent payment review found no actionable defects in the reviewed source and tests.
- Publication review found private local files and test key literals in the existing history.
  Current source cleanup does not remove that history. Public release remains a separate step.
- This checkout has no Stellar secrets. A new on-chain sale was not tested in this session.
- Contributions do not allocate credits or pay invoices from a pooled fund.
- One sandbox business account receives store invoice payments. Separate merchant accounts,
  live payments, refunds, disputes and webhooks are outside this build.
- Publishing the repository remains a separate step because the existing history has open
  secret-scan findings. No claim of public submission is made here.
