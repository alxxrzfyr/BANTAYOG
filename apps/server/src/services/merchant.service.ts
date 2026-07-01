import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@bantayog/db'
import { MerchantRepository } from '../repositories/merchant.repository.js'

/**
 * BE1-2.3 · Merchant CRUD Service
 */
export class MerchantService {
  private db: SupabaseClient<Database>
  private merchantRepo: MerchantRepository

  constructor(db: SupabaseClient<Database>) {
    this.db = db
    this.merchantRepo = new MerchantRepository(db)
  }

  /**
   * Registers a new merchant.
   * Creates credentials in Supabase Auth and inserts the merchant profile record.
   */
  async register(dto: {
    storeName: string;
    ownerName: string;
    mobileNumberE164: string;
    walletAddress: string;
    password?: string;
  }): Promise<any> {
    const db = this.db;

    // 1. Create the user in Supabase Auth via admin API
    const email = `${dto.mobileNumberE164.replace('+', '')}@merchant.bantayog.local`;
    const password = dto.password || 'defaultSecurePassword123!';

    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'merchant' },
      user_metadata: { role: 'merchant' }
    });

    if (authError) {
      throw new Error(`Failed to create merchant auth credentials: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Supabase Auth user creation returned empty data');
    }

    // 2. Insert merchant profile record
    const record = await this.merchantRepo.insert({
      auth_user_id: authData.user.id,
      store_name: dto.storeName,
      owner_name: dto.ownerName,
      mobile_number_e164: dto.mobileNumberE164,
      wallet_address: dto.walletAddress,
      status: 'APPROVED' // Default to approved on registration for phase 2/3 flows
    });

    return record;
  }

  /**
   * Returns a paginated list of merchants.
   */
  async list(page: number = 1, limit: number = 20): Promise<{
    data: any[];
    count: number;
  }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await (this.db as any)
      .from('merchants')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      data: data ?? [],
      count: count ?? 0
    };
  }

  /**
   * Approves a merchant and registers them on-chain.
   */
  async approve(merchantId: string): Promise<any> {
    const { data: merchant, error: fetchError } = await (this.db as any)
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .single();

    if (fetchError || !merchant) {
      throw new Error(`Merchant not found: ${fetchError?.message ?? merchantId}`);
    }

    const { data: updated, error: updateError } = await (this.db as any)
      .from('merchants')
      .update({ status: 'APPROVED' })
      .eq('id', merchantId)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to approve merchant: ${updateError?.message}`);
    }

    return updated;
  }
}
