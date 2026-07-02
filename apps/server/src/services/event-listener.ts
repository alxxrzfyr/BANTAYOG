import { createServiceClient } from '../lib/supabase.js'
import { ChainClient } from './chain.client.js'
import { logger } from '../lib/logger.js'

const TRANSACTION_PROCESSED_EVENT_ABI = {
  type: 'event',
  name: 'TransactionProcessed',
  inputs: [
    { indexed: true, name: 'beneficiaryId', type: 'bytes32' },
    { indexed: true, name: 'merchantAddress', type: 'address' },
    { indexed: false, name: 'amount', type: 'uint256' },
    { indexed: false, name: 'transactionId', type: 'bytes32' }
  ]
} as const

/**
 * Periodically polls the PHPCSubsidy smart contract for TransactionProcessed events.
 * Reconciles the matched transaction in the Supabase database.
 */
export function startChainEventListener() {
  const chainClient = new ChainClient()
  const db = createServiceClient()
  const listenerLogger = logger.child({ requestId: 'chain-event-listener' })
  const publicClient = chainClient.getPublicClient()
  const subsidyAddress = chainClient.getSubsidyAddress()

  let lastCheckedBlock = 0n

  async function poll() {
    try {
      const currentBlock = await publicClient.getBlockNumber()
      if (lastCheckedBlock === 0n) {
        lastCheckedBlock = currentBlock - 50n // scan last 50 blocks initially
        if (lastCheckedBlock < 0n) lastCheckedBlock = 0n
      }

      if (currentBlock <= lastCheckedBlock) {
        return
      }

      listenerLogger.debug({
        fromBlock: lastCheckedBlock + 1n,
        toBlock: currentBlock,
        msg: 'Polling for PHPCSubsidy logs...'
      })

      const logs = await publicClient.getLogs({
        address: subsidyAddress,
        event: TRANSACTION_PROCESSED_EVENT_ABI,
        fromBlock: lastCheckedBlock + 1n,
        toBlock: currentBlock
      })

      for (const log of logs) {
        const { transactionId: eventTxIdHash } = log.args

        if (!eventTxIdHash) continue

        // Fetch active transactions to find a hash match
        const { data: activeTxns, error } = await db
          .from('transactions')
          .select('id, status')
          .in('status', ['PENDING_CHAIN', 'SUBMITTED', 'CONFIRMED'])

        if (error) {
          listenerLogger.error({ error: error.message, msg: 'Failed to fetch active transactions for reconciliation' })
          continue
        }

        if (activeTxns) {
          for (const tx of activeTxns) {
            const calculatedHash = chainClient.hashUuid(tx.id)
            if (calculatedHash === eventTxIdHash) {
              listenerLogger.info({
                transactionId: tx.id,
                onchainTxHash: log.transactionHash,
                msg: 'On-chain transaction processed event detected. Reconciling to RECONCILED status.'
              })

              const { error: updateError } = await db
                .from('transactions')
                .update({
                  status: 'RECONCILED',
                  onchain_tx_hash: log.transactionHash,
                  confirmed_at: new Date().toISOString()
                })
                .eq('id', tx.id)

              if (updateError) {
                listenerLogger.error({
                  transactionId: tx.id,
                  error: updateError.message,
                  msg: 'Failed to update transaction to RECONCILED'
                })
              }
              break
            }
          }
        }
      }

      lastCheckedBlock = currentBlock
    } catch (err: any) {
      listenerLogger.error({ error: err.message, msg: 'Error in chain event listener poll cycle' })
    }
  }

  // Poll every 12 seconds
  listenerLogger.info({ msg: 'Started on-chain event listener polling (12s interval)' })
  setInterval(poll, 12000)
}
