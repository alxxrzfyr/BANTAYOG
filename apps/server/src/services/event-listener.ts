import type { BlockchainClient } from './chain.client.js'
import { logger } from '../lib/logger.js'

/**
 * DISABLED — superseded by the reconcile cron (`src/cron/reconcile.ts`).
 *
 * This listener used to poll the `PHPCSubsidy` contract for
 * `TransactionProcessed` events (emitted by the old `processTransaction`
 * call) and flip matched `transactions` rows to `RECONCILED`. Per the
 * polygon-amoy-phpc-migration migration (Task 3.5), `reconcile.ts` no longer
 * calls `PHPCSubsidy.processTransaction` — it settles purchases via a direct
 * `PHPC.transfer` (`BlockchainClient.transferPHPC`) to the merchant wallet,
 * and already flips the transaction to `CONFIRMED` itself once
 * `waitForConfirmation` succeeds. `TransactionProcessed` is therefore never
 * emitted anymore, so polling for it here would wait on an event that can
 * never fire.
 *
 * The design document (`design.md`) does not carry this component forward
 * as part of the rewritten `BlockchainClient` surface, and no other task in
 * the migration plan reintroduces subsidy-contract event polling. Left as a
 * disabled no-op (rather than deleted) so callers (e.g. `index.ts`) keep
 * compiling and the historical polling approach stays discoverable if a
 * future task decides on-chain event reconciliation is still needed.
 */
export function startChainEventListener(_chainClient: BlockchainClient) {
  const listenerLogger = logger.child({ requestId: 'chain-event-listener' })
  listenerLogger.info({
    msg: 'On-chain event listener disabled: superseded by reconcile cron (see src/cron/reconcile.ts)',
  })
}
