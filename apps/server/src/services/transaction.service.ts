import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TransactionStatus, OutboxStatus } from '@bantayog/db'
import { TransactionRepository } from '../repositories/transaction.repository.js'

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
  }): Promise<any> {
    const totalCreditDeducted = dto.items.reduce((sum, item) => sum + Number(item.creditCost), 0)
    // Convert credits to wei (assuming 1 credit = 1 PHPC = 10^18 wei)
    const stablecoinAmountWei = (BigInt(totalCreditDeducted) * BigInt(10 ** 18)).toString()

    // 1. Check if transaction with this idempotency key already exists
    const { data: existingTx, error: findError } = await this.db
      .from('transactions')
      .select('*')
      .eq('idempotency_key', dto.idempotencyKey)
      .maybeSingle()

    if (findError) throw findError
    if (existingTx) {
      return existingTx
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
      throw outboxError
    }

    return newTx
  }

  /**
   * Retrieves a single transaction by ID.
   */
  async getTransaction(id: string): Promise<any> {
    return await this.transactionRepo.findById(id)
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
  } = {}): Promise<{ data: any[]; count: number }> {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

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

    if (error) throw error

    return {
      data: data ?? [],
      count: count ?? 0
    }
  }

  /**
   * Updates transaction status.
   */
  async updateStatus(
    id: string,
    status: TransactionStatus,
    extra: { onchainTxHash?: string | null; confirmedAt?: string | null } = {}
  ): Promise<any> {
    const updatePayload: any = { status }
    if (extra.onchainTxHash !== undefined) {
      updatePayload.onchain_tx_hash = extra.onchainTxHash
    }
    if (extra.confirmedAt !== undefined) {
      updatePayload.confirmed_at = extra.confirmedAt
    }

    return await this.transactionRepo.updateById(id, updatePayload)
  }
}
