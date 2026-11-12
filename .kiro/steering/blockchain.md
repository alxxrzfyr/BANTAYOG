---
inclusion: manual
---

# Blockchain (Stellar Testnet + PHPC)

Single target network: **Stellar testnet**. The former Polygon Amoy stack was
removed by the stellar-migration work and a static test enforces that it stays gone.

## Assets and Accounts

- `PHPC` — mock PHP-pegged classic Stellar asset (the subsidy unit; 7 decimals, 1 credit = 1e7 stroops).
- **Issuing Account** — issues PHPC, has `AUTH_REQUIRED`, `AUTH_REVOCABLE`, and `AUTH_CLAWBACK_ENABLED` flags set.
- **Distribution Account** — holds the unallocated supply of PHPC.
- **Sponsor Account** — pays transaction fees (fee-bumps) for beneficiary and merchant transactions.

## Server-side chain layer

- `src/lib/chain/config.ts` — `loadChainConfig(env)` is the single entry point. It validates
  `STELLAR_HORIZON_URL`, `STELLAR_NETWORK_PASSPHRASE`, `PHPC_ASSET_CODE`,
  `PHPC_ISSUER_PUBLIC_KEY`, `PHPC_ISSUER_SECRET`, `PHPC_DISTRIBUTION_SECRET`,
  `STELLAR_SPONSOR_SECRET`, `CUSTODIAL_KEY_ENCRYPTION_KEY`, `QR_TOKEN_SECRET`,
  optional `QR_TOKEN_TTL_SECONDS`. It reports *all* offending variables in one `ValidationError`.
- `src/services/chain.client.ts` — `StellarClient.create(config)` wraps Stellar SDK calls.
  All methods return `AppResult`; failures surface as `OnchainError` (→ HTTP 502).
- `src/services/custodial-wallet.service.ts` — generates a per-beneficiary and per-merchant ed25519
  keypair. The private key is stored only as AES-256-GCM ciphertext keyed by
  `CUSTODIAL_KEY_ENCRYPTION_KEY`.
- The reconcile worker owns chain submission. The retired event listener and the unused
  descriptive state machine are not runtime components.

## Settlement model (ADR-004)

1. Checkout calls `settle_sale_and_enqueue`, which wraps `settle_sale`: beneficiary credit down,
   merchant audit balance up, transaction `PENDING_CHAIN`, and an outbox row in one transaction.
2. On-chain movement happens later:
   - `POST /api/cron/reconcile` drains `TRANSACTION_CHAIN_SUBMIT` outbox rows and submits
     fee-bumped beneficiary-to-merchant payments in PHPC.
    - The merchant balance view reads live PHPC from Horizon. It is not a cash-out endpoint.
3. Failure handling: up to 3 attempts, then outbox `FAILED`, transaction `FAILED`, and
   `TransactionService.restoreBeneficiaryBalance` writes a `BALANCE_RESTORATION_AUDIT` outbox row
   plus an error log.
4. Transaction state comes from stored records and worker results, not a separate state machine
   that only tests drive.

## Amount conversions

- 1 credit = 1 PHPC = 1e7 stroops. `TransactionService` computes integer stroops.
- The current merchant API exposes no wallet-connect or cash-out mutation.
- Allocations: Tier 1 = 5,000 PHPC, Tier 2 = 3,500 PHPC.

## Keys

`STELLAR_SPONSOR_SECRET` and distribution/issuer secrets must never leave the server boundary.
Never introduce a mainnet key or mainnet Horizon RPC.
