import { createServiceClient } from '../lib/supabase.js'
import { ChainClient } from '../services/chain.client.js'
import { logger } from '../lib/logger.js'

export interface ReconcileResult {
  processed: number
  failed: number
}

/**
 * Polling worker to process the transaction outbox and submit them to the blockchain.
 */
export async function runReconciliation(): Promise<ReconcileResult> {
  const db = createServiceClient()
  const chainClient = new ChainClient()
  const cronLogger = logger.child({ requestId: 'cron-reconcile' })

  // 1. Fetch PENDING outbox events
  const { data: pendingEvents, error: fetchError } = await db
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
    const { transactionId, beneficiaryId, merchantId, stablecoinAmountWei } = payload

    try {
      // Step 2: Mark outbox entry as PROCESSING to prevent duplicate runs
      const { error: lockError } = await db
        .from('outbox')
        .update({ status: 'PROCESSING' })
        .eq('id', event.id)

      if (lockError) {
        cronLogger.error({ eventId: event.id, error: lockError.message, msg: 'Failed to lock outbox event' })
        continue
      }

      // Step 3: Fetch merchant profile to get Ronin wallet address
      const { data: merchant, error: merchantError } = await db
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
        msg: 'Submitting transaction to Ronin Saigon testnet'
      })

      const amountBigInt = BigInt(stablecoinAmountWei)
      const txHash = await chainClient.processTransaction(
        beneficiaryId,
        merchant.wallet_address,
        amountBigInt,
        transactionId
      )

      cronLogger.info({ transactionId, txHash, msg: 'Submitted transaction on-chain. Waiting for confirmation...' })

      // Step 5: Wait for transaction confirmation block receipt
      const receipt = await chainClient.waitForTransactionReceipt(txHash)

      if (receipt && receipt.status === 'success') {
        cronLogger.info({ transactionId, txHash, msg: 'Transaction confirmed on-chain successfully!' })

        // Update outbox event to DONE
        await db
          .from('outbox')
          .update({
            status: 'DONE',
            processed_at: new Date().toISOString()
          })
          .eq('id', event.id)

        // Update transactions status to CONFIRMED
        await db
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
      await db
        .from('outbox')
        .update({
          status: isPermanentlyFailed ? 'FAILED' : 'PENDING',
          attempts: nextAttempts,
          last_error: error.message
        })
        .eq('id', event.id)

      if (isPermanentlyFailed) {
        // Mark transaction as failed in the DB
        await db
          .from('transactions')
          .update({ status: 'FAILED' })
          .eq('id', transactionId)
      }
    }
  }

  return { processed: processedCount, failed: failedCount }
}
