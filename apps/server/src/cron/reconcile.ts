import { createServiceClient } from '../lib/supabase.js'
import { BlockchainClient } from '../services/chain.client.js'
import { loadChainConfig } from '../lib/chain/config.js'
import { logger } from '../lib/logger.js'
import { TransactionService } from '../services/transaction.service.js'

export interface ReconcileResult {
  processed: number
  failed: number
}

/**
 * Polling worker to process the transaction outbox and submit them to the blockchain.
 */
export async function runReconciliation(): Promise<ReconcileResult> {
  const db = createServiceClient()
  const cronLogger = logger.child({ requestId: 'cron-reconcile' })

  const configResult = loadChainConfig(process.env)
  if (configResult.isErr()) {
    cronLogger.error({ error: configResult.error.message, msg: 'Failed to load chain config' })
    return { processed: 0, failed: 0 }
  }

  const clientResult = await BlockchainClient.create(configResult.value)
  if (clientResult.isErr()) {
    cronLogger.error({ error: clientResult.error.message, msg: 'Failed to construct BlockchainClient' })
    return { processed: 0, failed: 0 }
  }

  const chainClient = clientResult.value
  const transactionService = new TransactionService(db)

  // 1. Fetch PENDING outbox events
  const { data: pendingEvents, error: fetchError } = await (db as any)
    .from('outbox')
    .select('*')
    .eq('status', 'PENDING')
    .eq('kind', 'TRANSACTION_CHAIN_SUBMIT')
    .order('created_at', { ascending: true })
    .limit(20)

  if (fetchError) {
    cronLogger.error({ error: fetchError.message, msg: 'Failed to fetch pending outbox events' })
    return { processed: 0, failed: 0 }
  }

  if (!pendingEvents || pendingEvents.length === 0) {
    return { processed: 0, failed: 0 }
  }

  cronLogger.info({ count: pendingEvents.length, msg: 'Processing outbox events' })

  let processedCount = 0
  let failedCount = 0

  for (const event of pendingEvents) {
    const payload = event.payload_jsonb as any
    const { transactionId, beneficiaryId, merchantId, stablecoinAmountWei, totalCreditDeducted } = payload

    try {
      // Step 2: Mark outbox entry as PROCESSING to prevent duplicate runs
      const { error: lockError } = await (db as any)
        .from('outbox')
        .update({ status: 'PROCESSING' })
        .eq('id', event.id)

      if (lockError) {
        cronLogger.error({ eventId: event.id, error: lockError.message, msg: 'Failed to lock outbox event' })
        continue
      }

      // Step 3: Fetch merchant profile to get wallet address
      const { data: merchant, error: merchantError } = await (db as any)
        .from('merchants')
        .select('wallet_address')
        .eq('id', merchantId)
        .single()

      if (merchantError || !merchant) {
        throw new Error(`Merchant not found or has no wallet: ${merchantError?.message || merchantId}`)
      }

      // Step 4: Submit on-chain transaction
      cronLogger.info({
        transactionId,
        beneficiaryId,
        merchantWallet: merchant.wallet_address,
        amountWei: stablecoinAmountWei,
        msg: 'Submitting transaction to Polygon Amoy testnet'
      })

      // TODO(task 11): This is a plain PHPC transfer from the deployer/
      // treasury wallet to the merchant, not the old subsidy-contract
      // `processTransaction` (which atomically deducted from the
      // beneficiary's own on-chain balance and credited the merchant in one
      // call). Full custodial-wallet-based deduction semantics will be
      // implemented when the purchase flow is rebuilt in tasks 6/7/11; this
      // reconcile step currently only settles the merchant-credit leg.
      const amountBigInt = BigInt(stablecoinAmountWei)
      const transferResult = await chainClient.transferPHPC(merchant.wallet_address, amountBigInt)
      if (transferResult.isErr()) {
        throw new Error(transferResult.error.message)
      }
      const txHash = transferResult.value

      cronLogger.info({ transactionId, txHash, msg: 'Submitted transaction on-chain. Waiting for confirmation...' })

      // Step 5: Wait for transaction confirmation block receipt
      const receiptResult = await chainClient.waitForConfirmation(txHash)
      if (receiptResult.isErr()) {
        throw new Error(receiptResult.error.message)
      }
      const receipt = receiptResult.value

      if (receipt && receipt.status === 'success') {
        cronLogger.info({ transactionId, txHash, msg: 'Transaction confirmed on-chain successfully!' })

        // Update outbox event to DONE
        await (db as any)
          .from('outbox')
          .update({
            status: 'DONE',
            processed_at: new Date().toISOString()
          })
          .eq('id', event.id)

        // Update transactions status to CONFIRMED
        await (db as any)
          .from('transactions')
          .update({
            status: 'CONFIRMED',
            onchain_tx_hash: txHash,
            confirmed_at: new Date().toISOString()
          })
          .eq('id', transactionId)

        processedCount++
      } else {
        throw new Error(`Transaction on-chain receipt returned status: ${receipt?.status || 'unknown'}`)
      }

    } catch (error: any) {
      cronLogger.error({
        eventId: event.id,
        transactionId,
        error: error.message,
        msg: 'Outbox transaction processing failed'
      })

      failedCount++
      const nextAttempts = event.attempts + 1
      const isPermanentlyFailed = nextAttempts >= 3

      // Update outbox status to FAILED or back to PENDING for retry
      await (db as any)
        .from('outbox')
        .update({
          status: isPermanentlyFailed ? 'FAILED' : 'PENDING',
          attempts: nextAttempts,
          last_error: error.message
        })
        .eq('id', event.id)

      if (isPermanentlyFailed) {
        // Compensating action (Requirement 7.10 / Task 11.3): restore the
        // beneficiary's recorded balance if this outbox entry's flow
        // deducted it before on-chain settlement was confirmed.
        //
        // NOTE: as of Task 11.2, the live synchronous purchase route
        // (src/routes/transactions.ts) deducts the beneficiary's balance
        // only *after* the on-chain transfer has already confirmed, so an
        // outbox entry created by that path never reaches this branch with
        // a pre-deducted balance to restore — the inconsistency Requirement
        // 7.10 describes is prevented by construction, not repaired after
        // the fact. This restoration call is a defensive safety net for any
        // future or legacy code path that still creates a
        // TRANSACTION_CHAIN_SUBMIT outbox entry with the balance already
        // deducted (the old deduct-then-settle ordering).
        const restoreAmount = Number(totalCreditDeducted ?? 0)
        if (restoreAmount > 0) {
          const restoreResult = await transactionService.restoreBeneficiaryBalance(
            beneficiaryId,
            restoreAmount,
            'On-chain transfer failed after 3 retry attempts'
          )
          if (restoreResult.isErr()) {
            cronLogger.error({
              eventId: event.id,
              transactionId,
              beneficiaryId,
              error: restoreResult.error.message,
              msg: 'Failed to restore beneficiary balance after permanent on-chain transfer failure'
            })
          }
        }

        // Mark transaction as failed in the DB
        await (db as any)
          .from('transactions')
          .update({ status: 'FAILED' })
          .eq('id', transactionId)
      }
    }
  }

  return { processed: processedCount, failed: failedCount }
}
