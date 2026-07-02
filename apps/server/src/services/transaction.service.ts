import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TransactionStatus, OutboxStatus } from '@bantayog/db'
import { TransactionRepository } from '../repositories/transaction.repository.js'
import { type AppResult, ok, err, PersistenceError, ValidationError } from '../lib/errors.js'

export class TransactionService {
  private db: SupabaseClient<Database>
  private transactionRepo: TransactionRepository

  constructor(db: SupabaseClient<Database>) {
    this.db = db
    this.transactionRepo = new TransactionRepository(db)
  }

  /**
   * Atomically creates a transaction and an outbox entry.
   */
  async createTransaction(dto: {
    beneficiaryId: string
    merchantId: string
    items: any[]
    idempotencyKey: string
  }): Promise<AppResult<any>> {
    const totalCreditDeducted = dto.items.reduce((sum, item) => sum + Number(item.creditCost), 0)
    // Convert credits to wei (assuming 1 credit = 1 PHPC = 10^18 wei)
    const stablecoinAmountWei = (BigInt(totalCreditDeducted) * BigInt(10 ** 18)).toString()

    try {
      // 1. Check if transaction with this idempotency key already exists
      const { data: existingTx, error: findError } = await this.db
        .from('transactions')
        .select('*')
        .eq('idempotency_key', dto.idempotencyKey)
        .maybeSingle()

      if (findError) {
        return err(new PersistenceError(`Failed to check idempotency: ${findError.message}`, 'transactions'))
      }
      if (existingTx) {
        return ok(existingTx)
      }

      // 2. Insert transaction
      const newTx = await this.transactionRepo.insert({
        beneficiary_id: dto.beneficiaryId,
        merchant_id: dto.merchantId,
        item_list_jsonb: dto.items,
        total_credit_deducted: totalCreditDeducted,
        stablecoin_amount_wei: stablecoinAmountWei,
        idempotency_key: dto.idempotencyKey,
        status: 'PENDING_CHAIN',
        onchain_tx_hash: null,
        confirmed_at: null
      })

      // 3. Insert outbox entry for chain submission worker
      const { error: outboxError } = await (this.db as any)
        .from('outbox')
        .insert({
          kind: 'TRANSACTION_CHAIN_SUBMIT',
          payload_jsonb: {
            transactionId: newTx.id,
            beneficiaryId: newTx.beneficiary_id,
            merchantId: newTx.merchant_id,
            stablecoinAmountWei: newTx.stablecoin_amount_wei
          },
          status: 'PENDING' as OutboxStatus
        })

      if (outboxError) {
        // Clean up the created transaction if outbox insertion failed
        await this.transactionRepo.deleteById(newTx.id)
        return err(new PersistenceError(`Failed to insert outbox entry: ${outboxError.message}`, 'outbox'))
      }

      return ok(newTx)
    } catch (error: any) {
      return err(new PersistenceError(`Transaction creation failed: ${error.message}`, 'transactions'))
    }
  }

  /**
   * Retrieves a single transaction by ID.
   */
  async getTransaction(id: string): Promise<AppResult<any>> {
    try {
      const record = await this.transactionRepo.findById(id)
      if (!record) {
        return err(new ValidationError(`Transaction not found: ${id}`))
      }
      return ok(record)
    } catch (error: any) {
      return err(new PersistenceError(`Get transaction failed: ${error.message}`, 'transactions'))
    }
  }

  /**
   * Lists transactions with optional filters.
   */
  async listTransactions(filters: {
    merchantId?: string
    beneficiaryId?: string
    status?: TransactionStatus
    page?: number
    limit?: number
  } = {}): Promise<AppResult<{ data: any[]; count: number }>> {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    try {
      let query = this.db
        .from('transactions')
        .select('*', { count: 'exact' })

      if (filters.merchantId) {
        query = query.eq('merchant_id', filters.merchantId)
      }
      if (filters.beneficiaryId) {
        query = query.eq('beneficiary_id', filters.beneficiaryId)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        return err(new PersistenceError(`Failed to query transactions: ${error.message}`, 'transactions'))
      }

      return ok({
        data: data ?? [],
        count: count ?? 0
      })
    } catch (error: any) {
      return err(new PersistenceError(`List transactions failed: ${error.message}`, 'transactions'))
    }
  }

  /**
   * Updates transaction status.
   */
  async updateStatus(
    id: string,
    status: TransactionStatus,
    extra: { onchainTxHash?: string | null; confirmedAt?: string | null } = {}
  ): Promise<AppResult<any>> {
    try {
      const updatePayload: any = { status }
      if (extra.onchainTxHash !== undefined) {
        updatePayload.onchain_tx_hash = extra.onchainTxHash
      }
      if (extra.confirmedAt !== undefined) {
        updatePayload.confirmed_at = extra.confirmedAt
      }

      const updated = await this.transactionRepo.updateById(id, updatePayload)
      return ok(updated)
    } catch (error: any) {
      return err(new PersistenceError(`Update transaction status failed: ${error.message}`, 'transactions'))
    }
  }
}

