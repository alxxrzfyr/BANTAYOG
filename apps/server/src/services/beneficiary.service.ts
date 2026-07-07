import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'
import { BeneficiaryRepository } from '../repositories/beneficiary.repository.js'
import { BeneficiaryWalletRepository } from '../repositories/beneficiary-wallet.repository.js'
import { AllocationRepository } from '../repositories/allocation.repository.js'
import { PinService } from './pin.service.js'
import { QrTokenService } from './qr-token.service.js'
import { CustodialWalletService } from './custodial-wallet.service.js'
import { BlockchainClient } from './chain.client.js'
import { loadChainConfig } from '../lib/chain/config.js'
import { computeTier } from '../domain/eligibility.js'
import { type AppResult, ok, err, PersistenceError, ValidationError } from '../lib/errors.js'

/** Tier-based one-time allocation amounts, in whole PHPC (Requirements 4.1, 4.2). */
const TIER_1_ALLOCATION_PHPC = 5000
const TIER_2_ALLOCATION_PHPC = 3500

/** PHPC's on-chain decimals (18), used to convert whole-PHPC amounts to base units. */
const PHPC_DECIMALS = 18n

/** Bound (ms) on waiting for the on-chain allocation transaction to confirm (Requirement 4.8). */
const ALLOCATION_CONFIRMATION_TIMEOUT_MS = 60_000

/**
 * BE1-2.3 · Beneficiary CRUD Service
 */
export class BeneficiaryService {
  private db: SupabaseClient<Database>
  private beneficiaryRepo: BeneficiaryRepository
  private beneficiaryWalletRepo: BeneficiaryWalletRepository
  private allocationRepo: AllocationRepository
  private pinService: PinService

  constructor(db: SupabaseClient<Database>) {
    this.db = db
    this.beneficiaryRepo = new BeneficiaryRepository(db)
    this.beneficiaryWalletRepo = new BeneficiaryWalletRepository(db)
    this.allocationRepo = new AllocationRepository(db)
    this.pinService = new PinService()
  }

  /**
   * Registers a new beneficiary.
   * Computes initial tier, hashes PIN, inserts to DB, and generates the QR token.
   */
  async register(dto: {
    guardianName: string;
    guardianMobileHash: string;
    childName: string;
    childAgeMonths: number;
    monthlyIncomePhp: number;
    gpsLat: number;
    gpsLng: number;
    pin: string;
  }): Promise<AppResult<{
    beneficiary: any;
    tier: number;
    qrToken: string;
    cardSerial: string;
  }>> {
    try {
      // 1. Hash the PIN
      const pinResult = await this.pinService.hashPin(dto.pin);
      if (pinResult.isErr()) return err(pinResult.error);
      const hashedPin = pinResult.value;

      // 2. Generate unique card serial
      const cardSerial = 'BTY-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // 3. Compute initial tier
      const tier = computeTier(new Date(), dto.childAgeMonths);

      // 4. Load chain config lazily (only registration needs custodial wallet
      // generation; list()/getMetrics() etc. must still work without it).
      const chainConfigResult = loadChainConfig(process.env);
      if (chainConfigResult.isErr()) return err(chainConfigResult.error);
      const custodialWalletService = new CustodialWalletService(
        chainConfigResult.value,
        this.beneficiaryWalletRepo,
      );

      // 5. Insert beneficiary record (DB generates the id; it cannot be
      // supplied on insert per the `beneficiaries` Insert type).
      const record = await this.beneficiaryRepo.insert({
        guardian_name: dto.guardianName,
        guardian_mobile_hash: dto.guardianMobileHash,
        child_name: dto.childName,
        child_age_months: dto.childAgeMonths,
        monthly_income_php: dto.monthlyIncomePhp,
        gps_lat: dto.gpsLat,
        gps_lng: dto.gpsLng,
        pin_hash_argon2id: hashedPin,
        eligibility_status: 'ELIGIBLE',
        card_serial: cardSerial,
        credit_balance: 0,
        activated_at: new Date().toISOString()
      });

      // 6. Generate the beneficiary's custodial wallet. Beneficiary and
      // wallet creation aren't atomic (no cross-table transaction API
      // available here); on wallet generation failure we compensate by
      // deleting the just-inserted beneficiary row so no beneficiary record
      // remains, satisfying Requirement 5.6.
      const walletResult = await custodialWalletService.generateWallet(record.id);
      if (walletResult.isErr()) {
        try {
          await this.beneficiaryRepo.deleteById(record.id);
        } catch {
          // Swallow the compensating-delete failure — it must not mask the
          // original wallet-generation error below.
        }
        return err(walletResult.error);
      }
      const walletAddress = walletResult.value.address;

      // 7. Generate signed QR token JWS compact JWT, embedding the
      // beneficiary's custodial wallet address as `walletRef`. The TTL is
      // sourced from `ChainConfig.qrTokenTtlSeconds` (Requirement 9.1).
      const qrTokenService = new QrTokenService(chainConfigResult.value.qrTokenTtlSeconds);
      const tokenResult = await qrTokenService.generateToken({
        beneficiaryId: record.id,
        childName: record.child_name,
        guardianName: record.guardian_name,
        tier,
        pin_hash_ref: hashedPin.substring(0, 16), // PIN hash reference (first 16 chars)
        walletRef: walletAddress
      });
      if (tokenResult.isErr()) return err(tokenResult.error);
      const qrToken = tokenResult.value;

      // Save token payload into qr_passes table if necessary per spec
      const { error: qrPassError } = await (this.db as any).from('qr_passes').insert({
        beneficiary_id: record.id,
        token_payload: qrToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      });

      if (qrPassError) {
        return err(new PersistenceError(`Failed to save QR pass record: ${qrPassError.message}`, 'qr_passes'));
      }

      return ok({
        beneficiary: record,
        tier,
        qrToken,
        cardSerial
      });
    } catch (error: any) {
      return err(new PersistenceError(`Beneficiary registration failed: ${error.message}`, 'beneficiaries'));
    }
  }

  /**
   * Returns a paginated list of beneficiaries, with tiers dynamically re-evaluated.
   */
  async list(page: number = 1, limit: number = 20): Promise<AppResult<{
    data: any[];
    count: number;
  }>> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    try {
      // Fetch from Supabase directly for paginated query
      const { data, count, error } = await (this.db as any)
        .from('beneficiaries')
        .select('*, qr_passes(token_payload)', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) {
        return err(new PersistenceError(`Failed to list beneficiaries: ${error.message}`, 'beneficiaries'));
      }

      const listWithTiers = ((data || []) as any[]).map(b => {
        const tier = computeTier(b.created_at, b.child_age_months);
        let jwsCompact = b.jwsCompact || b.jws_compact;
        
        if (b.qr_passes && Array.isArray(b.qr_passes) && b.qr_passes.length > 0) {
          jwsCompact = b.qr_passes[0].token_payload;
        }

        return {
          ...b,
          tier,
          jwsCompact
        };
      });

      return ok({
        data: listWithTiers,
        count: count ?? 0
      });
    } catch (error: any) {
      return err(new PersistenceError(`Database list error: ${error.message}`, 'beneficiaries'));
    }
  }

  /**
   * Adds credit balance to a beneficiary.
   */
  async addCredits(beneficiaryId: string, amount: number): Promise<AppResult<any>> {
    try {
      const beneficiary = await this.beneficiaryRepo.findById(beneficiaryId);
      if (!beneficiary) {
        return err(new ValidationError(`Beneficiary not found: ${beneficiaryId}`));
      }

      const currentBalance = Number(beneficiary.credit_balance);
      const newBalance = currentBalance + amount;

      const updated = await this.beneficiaryRepo.updateById(beneficiaryId, {
        credit_balance: newBalance
      });

      return ok(updated);
    } catch (error: any) {
      return err(new PersistenceError(`Add credits failed: ${error.message}`, 'beneficiaries'));
    }
  }

  /**
   * Allocates the one-time tier-based PHPC credit to a beneficiary.
   *
   * Resolves the beneficiary's tier, rejects invalid tier classifications and
   * duplicate allocations, checks the on-chain treasury balance, submits the
   * on-chain allocation and waits up to 60 seconds for confirmation, and only
   * after confirmation increases the beneficiary's recorded balance and
   * persists the `allocations` record (which serves as this allocation's
   * Transaction_Record per the design's data model). Every rejection path
   * (invalid tier, duplicate allocation, insufficient treasury, on-chain
   * failure/timeout) returns before any balance is touched.
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 4.9
   */
  async allocateTierCredits(beneficiaryId: string): Promise<AppResult<{
    beneficiary: any;
    amount: number;
    txHash: string;
  }>> {
    try {
      // 1. Resolve the beneficiary and its tier.
      const beneficiary = await this.beneficiaryRepo.findById(beneficiaryId)
      if (!beneficiary) {
        return err(new ValidationError(`Beneficiary not found: ${beneficiaryId}`))
      }
      const tier = computeTier(beneficiary.created_at, beneficiary.child_age_months)

      // 2. Reject invalid tier classification (Requirement 4.9). `computeTier`
      // only ever returns 1 | 2 by its type signature today, so this branch
      // is unreachable given current domain logic — it is a defensive guard
      // against future changes to tier computation that might widen its
      // return type or produce an unexpected value.
      if (tier !== 1 && tier !== 2) {
        return err(new ValidationError('Invalid tier classification'))
      }

      // 3. Reject duplicate allocation (Requirement 4.7) without touching
      // any balance.
      const existing = await this.allocationRepo.findBy('beneficiary_id', beneficiaryId, 1)
      if (existing.length > 0) {
        return err(new ValidationError('Beneficiary already has a prior allocation'))
      }

      // 4. Determine the tier amount (Requirements 4.1, 4.2).
      const amountPhpc = tier === 1 ? TIER_1_ALLOCATION_PHPC : TIER_2_ALLOCATION_PHPC
      const amountWei = BigInt(amountPhpc) * 10n ** PHPC_DECIMALS

      // 5. Load ChainConfig and construct the BlockchainClient.
      const chainConfigResult = loadChainConfig(process.env)
      if (chainConfigResult.isErr()) return err(chainConfigResult.error)
      const clientResult = await BlockchainClient.create(chainConfigResult.value)
      if (clientResult.isErr()) return err(clientResult.error)
      const client = clientResult.value

      // 6. Check treasury balance (Requirement 4.4) before submitting
      // anything on-chain.
      const treasuryResult = await client.getTreasuryBalance()
      if (treasuryResult.isErr()) return err(treasuryResult.error)
      if (treasuryResult.value < amountWei) {
        return err(new ValidationError('Insufficient treasury balance for allocation'))
      }

      // 7. Submit the on-chain allocation and wait up to 60s for
      // confirmation (Requirement 4.8). BlockchainClient's own methods
      // already return AppResult/OnchainError with no side effects on
      // failure/timeout, so propagating these errors here satisfies
      // "abort the allocation, leave balances unchanged" — no balance or DB
      // state has been mutated at any point before this line.
      const allocResult = await client.allocateCredits(beneficiaryId, amountWei)
      if (allocResult.isErr()) return err(allocResult.error)
      const txHash = allocResult.value
      const confirmResult = await client.waitForConfirmation(txHash, ALLOCATION_CONFIRMATION_TIMEOUT_MS)
      if (confirmResult.isErr()) return err(confirmResult.error)

      // 8. Only after confirmation: increase the beneficiary's recorded
      // balance (Requirements 4.1, 4.2, 4.3). The treasury-tracking balance
      // is `client.getTreasuryBalance()` itself, which reflects on-chain
      // state — there is no separate off-chain treasury-balance column to
      // decrement in this schema, so no additional write is made for it.
      const newBalance = Number(beneficiary.credit_balance) + amountPhpc
      const updated = await this.beneficiaryRepo.updateById(beneficiaryId, {
        credit_balance: newBalance,
      })

      // 9. Persist the allocation record (Requirement 4.5). The
      // `allocations` row — beneficiary id, amount, tier, on-chain tx hash,
      // allocated_at timestamp — is this allocation's Transaction_Record per
      // the design's Allocation Record data model. `reconciled` defaults to
      // false; reconciliation is handled by a separate task (10.2).
      await this.allocationRepo.insert({
        beneficiary_id: beneficiaryId,
        tier,
        amount_phpc: amountPhpc,
        onchain_tx_hash: txHash,
      })

      return ok({
        beneficiary: updated,
        amount: amountPhpc,
        txHash,
      })
    } catch (error: any) {
      return err(new PersistenceError(`Allocation failed: ${error.message}`, 'allocations'))
    }
  }

  /**
   * Reconciles a beneficiary's one-time allocation, flagging the
   * `allocations.reconciled` column and returning an identifying error on
   * mismatch (Requirement 4.6).
   *
   * The current `BlockchainClient` surface has no per-beneficiary on-chain
   * ledger read (`PHPCSubsidy.getBalance(bytes32)` was dropped from the
   * design's `BlockchainClient` interface — see `chain.client.ts`), so this
   * reconciliation combines two checks that ARE possible with today's
   * surface:
   *
   *   (a) An off-chain internal consistency check: the beneficiary's
   *       recorded `credit_balance` must equal the recorded allocation's
   *       `amount_phpc`. Since this is a one-time allocation with no
   *       purchase-deduction path exercised yet at reconciliation time,
   *       `credit_balance` should exactly equal `amount_phpc`; any
   *       divergence signals the recorded balance was never fully credited
   *       (or was corrupted) relative to what the allocation record says
   *       was allocated.
   *   (b) A genuine on-chain check: re-confirming the allocation's
   *       `onchain_tx_hash` via `BlockchainClient.waitForConfirmation`. If
   *       the transaction cannot be re-confirmed, that's a real signal the
   *       on-chain allocation never landed (or was dropped/reorged),
   *       independent of whatever the DB believes.
   *
   * A true on-chain reconciliation would additionally require exposing a
   * beneficiary-ledger read method on `BlockchainClient` (e.g. re-adding
   * `PHPCSubsidy.getBalance(bytes32)`), which is out of this task's scope;
   * flagging as a follow-up.
   *
   * Requirements: 4.6
   */
  async reconcileAllocation(beneficiaryId: string): Promise<AppResult<{ reconciled: boolean }>> {
    try {
      // 1. Look up the allocation record.
      const allocations = await this.allocationRepo.findBy('beneficiary_id', beneficiaryId, 1)
      if (allocations.length === 0) {
        return err(new ValidationError('No allocation record found for beneficiary: ' + beneficiaryId))
      }
      const allocation = allocations[0]

      // 2. Look up the beneficiary.
      const beneficiary = await this.beneficiaryRepo.findById(beneficiaryId)
      if (!beneficiary) {
        return err(new ValidationError('Beneficiary not found: ' + beneficiaryId))
      }

      // 3. Load ChainConfig and construct the BlockchainClient, propagating
      // errors the same way `allocateTierCredits` does.
      const chainConfigResult = loadChainConfig(process.env)
      if (chainConfigResult.isErr()) return err(chainConfigResult.error)
      const clientResult = await BlockchainClient.create(chainConfigResult.value)
      if (clientResult.isErr()) return err(clientResult.error)
      const client = clientResult.value

      // 4a. Off-chain internal consistency check: recorded balance vs.
      // recorded allocation amount.
      const recordedBalanceMismatch = Number(beneficiary.credit_balance) !== allocation.amount_phpc

      // 4b. Genuine on-chain check: re-confirm the allocation's tx hash.
      const confirmResult = await client.waitForConfirmation(
        allocation.onchain_tx_hash as `0x${string}`,
        5_000,
      )
      const onchainConfirmationMismatch = confirmResult.isErr()

      const mismatch = recordedBalanceMismatch || onchainConfirmationMismatch

      if (mismatch) {
        // 5. Flag as unreconciled with an identifying error.
        await this.allocationRepo.updateById(allocation.id, { reconciled: false })
        return err(new ValidationError('Allocation reconciliation mismatch detected for beneficiary: ' + beneficiaryId))
      }

      // 6. Match: flag as reconciled.
      await this.allocationRepo.updateById(allocation.id, { reconciled: true })
      return ok({ reconciled: true })
    } catch (error: any) {
      return err(new PersistenceError(`Reconciliation failed: ${error.message}`, 'allocations'))
    }
  }

  /**
   * Looks up a beneficiary and returns it with dynamically computed tier.
   */
  async verifyAndReevaluateTier(beneficiaryId: string): Promise<AppResult<{ beneficiary: any; tier: number }>> {
    try {
      const beneficiary = await this.beneficiaryRepo.findById(beneficiaryId)
      if (!beneficiary) {
        return err(new ValidationError(`Beneficiary not found: ${beneficiaryId}`))
      }

      const tier = computeTier(beneficiary.created_at, beneficiary.child_age_months)
      return ok({
        beneficiary,
        tier
      })
    } catch (error: any) {
      return err(new PersistenceError(`Verify and re-evaluate tier failed: ${error.message}`, 'beneficiaries'))
    }
  }

  /**
   * Returns aggregate metrics for the admin dashboard.
   */
  async getMetrics(): Promise<AppResult<{
    totalBeneficiaries: number;
    criticalUnits: number;
    allocatedPhpc: string;
    verifiedMerchants: number;
  }>> {
    try {
      // Total beneficiaries
      const { count: totalBeneficiaries, error: countError } = await (this.db as any)
        .from('beneficiaries')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        return err(new PersistenceError(`Metrics count error: ${countError.message}`, 'beneficiaries'));
      }

      // Sum of all credit balances
      const { data: sumData, error: sumError } = await (this.db as any)
        .from('beneficiaries')
        .select('credit_balance');

      if (sumError) {
        return err(new PersistenceError(`Metrics sum error: ${sumError.message}`, 'beneficiaries'));
      }

      const totalCredits = (sumData ?? []).reduce(
        (acc: number, row: any) => acc + Number(row.credit_balance),
        0,
      );

      // Count critical units (tier 1) — compute dynamically
      const { data: allBeneficiaries, error: allError } = await (this.db as any)
        .from('beneficiaries')
        .select('created_at, child_age_months');

      if (allError) {
        return err(new PersistenceError(`Metrics tier error: ${allError.message}`, 'beneficiaries'));
      }

      let criticalUnits = 0;
      for (const b of allBeneficiaries ?? []) {
        const tier = computeTier(b.created_at, b.child_age_months);
        if (tier === 1) criticalUnits++;
      }

      // Verified merchants count
      const { count: verifiedMerchants, error: merchantError } = await (this.db as any)
        .from('merchants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'APPROVED');

      if (merchantError) {
        return err(new PersistenceError(`Metrics merchant error: ${merchantError.message}`, 'merchants'));
      }

      return ok({
        totalBeneficiaries: totalBeneficiaries ?? 0,
        criticalUnits,
        allocatedPhpc: totalCredits.toLocaleString('en-PH'),
        verifiedMerchants: verifiedMerchants ?? 0,
      });
    } catch (error: any) {
      return err(new PersistenceError(`Metrics computation failed: ${error.message}`));
    }
  }
}

