import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'
import { BeneficiaryRepository } from '../repositories/beneficiary.repository.js'
import { PinService } from './pin.service.js'
import { QrTokenService } from './qr-token.service.js'
import { computeTier } from '../domain/eligibility.js'
import { AppResult, ok, err, PersistenceError, ValidationError } from '../lib/errors.js'

/**
 * BE1-2.3 · Beneficiary CRUD Service
 */
export class BeneficiaryService {
  private db: SupabaseClient<Database>
  private beneficiaryRepo: BeneficiaryRepository
  private pinService: PinService
  private qrTokenService: QrTokenService

  constructor(db: SupabaseClient<Database>) {
    this.db = db
    this.beneficiaryRepo = new BeneficiaryRepository(db)
    this.pinService = new PinService()
    this.qrTokenService = new QrTokenService()
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

      // 4. Insert beneficiary record
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
        activated_at: new Date().toISOString(),
        intervention_tier: tier
      });

      // 5. Generate signed QR token JWS compact JWT
      const tokenResult = await this.qrTokenService.generateToken({
        beneficiaryId: record.id,
        childName: record.child_name,
        guardianName: record.guardian_name,
        tier,
        pin_hash_ref: hashedPin.substring(0, 16) // PIN hash reference (first 16 chars)
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
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) {
        return err(new PersistenceError(`Failed to list beneficiaries: ${error.message}`, 'beneficiaries'));
      }

      const listWithTiers = ((data || []) as any[]).map(b => {
        const tier = computeTier(b.created_at, b.child_age_months);
        return {
          ...b,
          tier
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

