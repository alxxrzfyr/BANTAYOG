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

Before phase 3, the full checks passed: `pnpm lint --concurrency=1`, `pnpm type-check --concurrency=1`, and
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

## Android browser checks

Android Studio Device Manager created a Medium Phone with the installed Android 17.0
(API 37) x86_64 image. T3 opened it in the Device panel. The production PWA ran in Android
Chrome through a local port forward. No APK was built or installed.

- The contribution page rejected PHP 0.00. Its PayPal link opened the sandbox checkout.
- PayPal cancel-and-return showed the cancellation notice in BANTAYOG.
- The return link for the existing completed test order recovered the same receipt: gross
  PHP 50.00, fee PHP 16.95 and net PHP 33.05. It cleared the callback query. This check did not
  make a new payment on Android.
- The receipt page fit 411 CSS pixels with no horizontal overflow. It kept the existing design.
- The production service worker controlled the page. Anonymous ledger access returned HTTP 401
  with `Cache-Control: no-store`. The browser cache held no API or Authorization-bearing request.
- Signed-out admin access returned to the login page. The merchant claims page showed that the
  session had ended and exposed no claim data.

Authenticated merchant and officer flows were checked in Brave as recorded above. They were
not repeated on Android. The five Android QA tabs were closed. The emulator remains available.

## Fund-backed grant checks

The phase 3 checks passed: `pnpm lint --concurrency=1`, `pnpm type-check --concurrency=1`,
and `pnpm run test --concurrency=1`. The suites passed 111 schema, 69 database, 502 server
and 200 web tests (882 total).

Migration `00020_fund_backed_grants.sql` passed the owner project's rollback check, then was
applied on November 12, 2026. The rollback removed the new table and restored the original
eight ledger columns. After application, the view had the two new money fields. Its original
totals and the counts of beneficiaries, allocations and contributions stayed unchanged.
The fund showed PHP 33.05 available and PHP 0.00 reserved.

Native PostgreSQL 17.12 checks used separate connections and observed the advisory lock wait.
Five cases passed: different children in both request orders, the same child in both fixture
cases, and a first request that rolled back. Each case left one PHP 5,000.00 reservation and
PHP 0.00 available. Tab-only, newline-only and mixed-whitespace transaction proof could not
finalize a reservation. Matching nonblank proof could finalize it. These checks used isolated
existing-table fixtures; the PGlite fresh-install tests checked the full application schema.

A normal admin session in Brave requested a grant for one temporary synthetic child. The
real API returned HTTP 400: needed PHP 5,000.00, available PHP 33.05. The modal showed the
server message and its fund link. The response used `Cache-Control: no-store`. Credit stayed
at zero; no allocation or reservation was added. Keyboard activation of the fund link worked.
The owned child was then removed. All original counts and ledger totals were checked again.
Anonymous grant and fund-ledger requests returned HTTP 401 with `no-store` through both the
API and the web proxy.

Phone QA reproduced an admin header overflow at 390 CSS pixels. The header now wraps its
navigation below the logo on small screens. At 320 and 390 CSS pixels, the ledger had no
page-level horizontal overflow. All navigation links were 44 pixels high. At 1440 CSS pixels,
the original desktop row remained. Branding, colors and fonts stayed the same.

The public fund page states the grant funding rule and fits 390 CSS pixels. It rejected a
zero contribution locally. The existing paid invoice in the merchant page showed that the
funder paid the program and that store payout is separate. No new payment ran in these checks.

## Remaining checks and limits

- Independent payment review found no actionable defects in the reviewed source and tests.
- Final grant review found a missing setup step in the server guide. The guide now includes
  migration `00020` and the requirement to stop older API instances before grant issuance.
  The review found no actionable code defects in the grant gate or the updated web views.
- The [public source repository](https://github.com/Yahiro025/BANTAYOG-PayPal-Hackathon) uses a
  separate reviewed history. The original repository retains private history and must stay private.
- This checkout has no Stellar secrets. A successful funded Stellar grant was not run here.
  Service tests use a fake chain client. The real hosted refusal path was checked as recorded above.
- Contributions back new grants through SQL reservations. An officer must still start each
  grant. Contributions do not pay store invoices from the pool.
- One sandbox business account receives store invoice payments. Separate merchant accounts,
  live payments, refunds, disputes and webhooks are outside this build.
- No Devpost submission or new video was made in this work.
