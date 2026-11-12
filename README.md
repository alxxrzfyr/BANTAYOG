<div align="center">

<img src="./assets/logo.png" alt="BANTAYOG logo" width="500" />

# BANTAYOG

**Food credits where families already shop.**

BANTAYOG lets families use nutrition credits at approved neighborhood stores.
Guardians carry a printed QR Nutri-Pass; merchants use a smartphone to accept it.

[How it works](#how-it-works) · [PayPal and AI](#paypal-and-ai) · [Quick Start](#quick-start) · [Demo and APK](#demo-and-downloads)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](LICENSE)
[![Stellar: Testnet](https://img.shields.io/badge/Stellar-Testnet-000000?style=flat&logo=stellar&logoColor=white)](#tech-stack)

</div>

<br>

## Why BANTAYOG

Food assistance is useful only when families can redeem it. The Philippines'
[DSWD Walang Gutom Program](https://www.dswd.gov.ph/dswds-walang-gutom-program-identifies-beneficiaries-based-on-psas-family-income-and-expenditure-survey-updated-cbms-database/)
already provides food credits through authorized retailers. But a nearby sari-sari store—a small
neighborhood shop—cannot accept those credits unless it is an approved partner. The
[DSWD implementation guidelines](https://old.dswd.gov.ph/issuances/MCs/MC_2024-019.pdf) recognize
retailer-access challenges in underserved areas.

BANTAYOG proposes a phone-based redemption system for stores approved by a Local Government
Unit (LGU) or aid program. It restricts credits to approved food and gives operators item-level
purchase records. The current prototype serves children and guardians in the **First 1,000 Days**
program, which focuses on nutrition from conception through the child's first two years.

The guardian needs no smartphone or account, and the store needs no dedicated point-of-sale
terminal. BANTAYOG uses its own demonstration credits; it does not accept DSWD EBT card balances,
connect to DSWD systems, or claim an agency partnership.

### Who uses it

| User | What they can do |
| --- | --- |
| **LGU administrator** | Register guardians and children, issue grants, print passes, and review store claims. |
| **Merchant** | Build food baskets, accept credits with a phone, view sales, and request payment for confirmed purchases. |
| **Guardian** | Use the printed pass to buy approved food and view the balance and 50 most recent purchases. |

<br>

## How it works

1. **Register the family.** An administrator records the guardian and child, registers a 6-digit
   guardian PIN, and prints a signed QR Nutri-Pass. This pass identifies the beneficiary at checkout.
2. **Issue a funded grant.** The server calculates the child's tier from age. Tier 1 receives
   **5,000 credits** through 730 days from birth, equivalent to 1,000 days from conception.
   Tier 2 receives **3,500 credits** after that point. Each child gets one grant only, and the
   system requires sufficient verified PayPal funding before issuance. **One credit is one peso.**
3. **Build an eligible basket.** The merchant photographs packaged products or selects fresh-market
   items such as rice and vegetables. Gemini helps identify products and estimate prices.
   The approved food catalog—not the AI—decides what the credits can buy.
4. **Authorize checkout.** The merchant scans the pass, and the guardian enters the PIN. The
   server checks the pass, beneficiary status, PIN, purchase total, and available credits.
   Five wrong PIN entries cause a 15-minute lockout.
5. **Record the purchase.** The database deducts the guardian's credits, adds the same amount to
   the store's recorded balance, and writes the receipt in one transaction. The merchant does not
   wait for the later Stellar testnet record. The guardian can use the pass to view the updated balance.

For example, an approved **₱120 basket uses 120 credits** and creates a ₱120 sale record for the
store. Recording that sale does not mean the store has received cash; payment is a separate flow.

All eligibility, tier, and balance decisions stay on the server. Database checks prevent repeat
checkout requests from charging twice and prevent the same sale from being claimed twice.

<br>

## PayPal and AI

PayPal serves two distinct purposes: backing new grants and recording payment of store claims.
AI assists with product identification and claim review; it does not control the money.

1. **Fund the program.** A funder contributes at `/fund`. The server verifies the completed
   PayPal payment and records the contribution, PayPal fee, and net amount left after that fee.
   Only the net amount can back new grants. The database reserves funding before a grant is
   issued, so the same contribution cannot back more credits than it covers.
2. **Review the store claim.** A merchant requests payment for confirmed, unpaid sales. Server
   rules flag unusual prices, and Gemini writes a review summary. An officer checks the sales
   and ledger proof, resolves holds where appropriate, and approves the invoice. AI cannot change
   amounts or release a server hold.
3. **Verify invoice payment.** The server creates and sends a PayPal invoice to the funder.
   BANTAYOG marks it paid only after PayPal returns `PAID`, not merely after a checkout redirect.

**All payments use sandbox test funds.** Invoice payments go to one program business account,
not directly to individual stores. The program must pay each store through a separate local
transfer; a paid invoice does not prove that transfer. Stores need no PayPal account. Contributions
back grants but do not automatically pay invoices from a pooled fund.

<br>

## Quick Start

### Requirements

- **Node.js 20+** and **pnpm 9.15.0**, pinned in `packageManager`.
- Your own **Supabase project** for data and sign-in, and **Upstash Redis** for rate limits and PIN lockout.
- A **Gemini API key** for product recognition and AI review.
- **PayPal sandbox accounts and app keys** for contributions and invoices.
- Internet access to **Stellar testnet**. The bootstrap script creates the accounts; no manual
  account creation is needed.

### Set up and run

Run these steps from the **repository root**:

1. **Install dependencies and copy the environment examples.** Fill in your own values using the
   [server setup guide](apps/server/README.md). Keep private keys and server secrets out of the browser.

   ```sh
   pnpm install
   cp .env.example .env
   cp apps/server/.env.example apps/server/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

2. **Prepare Supabase.** Follow the [database setup guide](docs/paypal-hackathon/setup.md) for a
   new or existing project. PayPal requires migrations `00018`, `00019`, and `00020`.
   Do not replay applied migrations. Stop older API instances before grant issuance and use the
   source revision that matches migration `00020`. The guide also explains test-user setup.

3. **Create the testnet asset.** PHPC is the mock peso-denominated asset used for the ledger
   record. The bootstrap creates accounts and prepares PHPC. It can run again after a testnet reset.

   ```sh
   pnpm bootstrap:stellar
   ```

4. **Start the web app and API.**

   ```sh
   pnpm dev
   ```

The web app runs at **<http://localhost:3000>** and the API at **<http://localhost:3001>**.
Open `/fund` to contribute sandbox funds. After signing in with the required role, use
`/admin/fund` for funding, `/dashboard/settlements` for merchant claims, and `/admin/settlements`
for officer review. A new grant requires sufficient net funding, and an invoice requires confirmed sales.

**Payment-only setup:** Contributions and invoice checks against existing confirmed test sales
do not require Stellar keys. Keep `RECONCILE_INTERVAL_MS=0` so the server does not process the
chain queue without them. Follow the [setup guide](docs/paypal-hackathon/setup.md) for this path.

### Development checks

Run the development checks from the same directory:

```sh
pnpm lint
pnpm type-check
pnpm test
```

<br>

## Tech Stack

`apps/web` provides the interface; `apps/server` owns business rules and API operations.
Shared packages provide request schemas and database types.

| Layer | Technology and purpose |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, and Tailwind CSS 4 for the admin, merchant, and guardian screens. |
| Android | Capacitor 8 packages the merchant frontend as an installable app. |
| API | Hono 4 handles requests; Zod 4 validates inputs; neverthrow represents expected failures. |
| Data and rate limits | Supabase Postgres and Auth store records and manage sign-in. Upstash Redis limits requests and PIN attempts. |
| AI | Google Gemini assists with product recognition, price estimates, and claim summaries. |
| Ledger | Stellar testnet records mock PHPC transfers, with sponsored transaction fees and no Soroban contracts. |
| Workspace and tests | pnpm 9 and Turborepo 2 manage packages. Vitest 2 and fast-check test behavior and boundary cases. |

<br>

## Documentation

- [Architecture](docs/context/ARCHITECTURE.md) — application boundaries and data flow.
- [Server setup](apps/server/README.md) — configuration and sandbox payment routes.
- [Settlement contract](docs/designs/paypal-settlement.md) and [fund contract](docs/designs/paypal-fund.md) — payment rules.
- [Verification record](docs/paypal-hackathon/verification.md) — completed checks and test scope.
- [PayPal event guide](docs/paypal-hackathon/) and [showcase guide](docs/SHOWCASE.md) — event context.

<br>

## Team

**JUMBO HOTDOG** built BANTAYOG for SparkFest 2026, organized by GDG on Campus – Polytechnic
University of the Philippines. The team placed **1st Runner-Up** on July 9, 2026.

| Name | Role |
| --- | --- |
| Bennett P. Payoyo | Developer / Researcher |
| Alex L. Berin Jr. | Developer / Researcher |
| Anjoe Mikael T. Albano | Developer / Researcher |
| Tyrone Loius V. Teemer | Developer / Researcher |

<br>

## Demo and downloads

- [Watch the demo](https://drive.google.com/file/d/1HbexEd2dmRrOxbiT5l1bJY4QRoW5PWiQ/view?usp=drive_link)
- [Download the Android APK](https://drive.google.com/drive/folders/1WBwtM_48NqHBRsulMHh0qs_ClyvFr24N?usp=sharing)
- [Test sign-in details](https://drive.google.com/file/d/1D7TcflxdrH6FG4aDZIQkJAVpAizVpaKg/view?usp=sharing)

<br>

## License

[MIT](LICENSE) © 2026 BANTAYOG contributors.
