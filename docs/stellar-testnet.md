# Stellar testnet operations

BANTAYOG uses Stellar testnet and a mock PHPC asset. Read chain configuration only through
`loadChainConfig` in `apps/server/src/lib/chain/config.ts`. The
[server guide](../apps/server/README.md) lists the required environment variables.

## Bootstrap

Run these commands from the repository root after configuring the environment:

```sh
pnpm bootstrap:stellar
```

The bootstrap prepares the issuer flags, distribution trustline, and mock asset supply. It can
run again after a testnet reset. To provision the bootstrap accounts without asset operations:

```sh
pnpm bootstrap:stellar -- --provision-only
```

## Existing beneficiary and merchant accounts

Testnet resets can remove accounts even when their database rows still exist. Review the account
state before using the re-provisioning command:

```sh
pnpm provision:stellar
```

Get owner approval before any operation spends from the sponsor account. Do not run an old data
cutover or replay an applied migration to recover from a testnet reset.

## Credentials and evidence

Keep secret seeds and local credential files out of Git, logs, and documentation. Use the
configured issuer rather than copying addresses from an earlier testnet run. Record new checks
with their date; an old transaction hash does not prove the current deployment works.

The [August 4 bootstrap snapshot](archive/snapshots/stellar-testnet-bootstrap-2026-08-04.md)
and [completed migration runbook](archive/implemented/stellar-migration-runbook.md) remain
available as historical records. The [Stellar ADR](adr/004-stellar-migration.md) keeps the
future Soroban roadmap.
