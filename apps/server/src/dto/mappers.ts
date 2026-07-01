import { computeTier } from '../domain/eligibility.js'

export interface BeneficiaryDTO {
  id: string
  guardianName: string
  guardianMobileHash: string
  childName: string
  childAgeMonths: number
  monthlyIncomePhp: number
  gpsLat: number
  gpsLng: number
  eligibilityStatus: string
  creditBalance: number
  cardSerial: string | null
  activatedAt: string | null
  deactivatedAt: string | null
  createdAt: string
  tier: number
}

export interface MerchantDTO {
  id: string
  authUserId: string
  storeName: string
  ownerName: string
  mobileNumberE164: string
  walletAddress: string
  status: string
  createdAt: string
}

export interface TransactionDTO {
  id: string
  beneficiaryId: string
  merchantId: string
  items: any[]
  totalCreditDeducted: number
  stablecoinAmountWei: string
  onchainTxHash: string | null
  idempotencyKey: string
  status: string
  createdAt: string
  confirmedAt: string | null
}

export interface VisionCandidateDTO {
  name: string
  confidence: number
  product: {
    id: string
    name: string
    eligibilityStatus: string
    category: string
  } | null
}

export interface ProductClassificationDTO {
  identified: boolean
  candidates?: VisionCandidateDTO[]
  reason?: string
}

export interface WalletBalanceDTO {
  address: string
  balance: string
  formatted: string
}

export function toBeneficiaryDTO(row: any): BeneficiaryDTO {
  const tier = row.tier ?? computeTier(row.created_at, row.child_age_months)
  return {
    id: row.id,
    guardianName: row.guardian_name,
    guardianMobileHash: row.guardian_mobile_hash,
    childName: row.child_name,
    childAgeMonths: row.child_age_months,
    monthlyIncomePhp: Number(row.monthly_income_php),
    gpsLat: row.gps_lat,
    gpsLng: row.gps_lng,
    eligibilityStatus: row.eligibility_status,
    creditBalance: Number(row.credit_balance),
    cardSerial: row.card_serial || null,
    activatedAt: row.activated_at || null,
    deactivatedAt: row.deactivated_at || null,
    createdAt: row.created_at,
    tier
  }
}

export function toMerchantDTO(row: any): MerchantDTO {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    storeName: row.store_name,
    ownerName: row.owner_name,
    mobileNumberE164: row.mobile_number_e164,
    walletAddress: row.wallet_address,
    status: row.status,
    createdAt: row.created_at
  }
}

export function toTransactionDTO(row: any): TransactionDTO {
  return {
    id: row.id,
    beneficiaryId: row.beneficiary_id,
    merchantId: row.merchant_id,
    items: row.item_list_jsonb || [],
    totalCreditDeducted: Number(row.total_credit_deducted || row.total_amount || 0),
    stablecoinAmountWei: row.stablecoin_amount_wei || '0',
    onchainTxHash: row.onchain_tx_hash || null,
    idempotencyKey: row.idempotency_key || '',
    status: row.status,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at || null
  }
}

export function toClassificationDTO(result: any): ProductClassificationDTO {
  if (!result.identified) {
    return {
      identified: false,
      reason: result.reason
    }
  }

  const candidates: VisionCandidateDTO[] = (result.candidates || []).map((c: any) => {
    let mappedProduct = null
    if (c.product) {
      mappedProduct = {
        id: c.product.id,
        name: c.product.name,
        eligibilityStatus: c.product.eligibility_status,
        category: c.product.category
      }
    }

    return {
      name: c.name,
      confidence: c.confidence,
      product: mappedProduct
    }
  })

  return {
    identified: true,
    candidates
  }
}

export function toBalanceDTO(result: any): WalletBalanceDTO {
  return {
    address: result.address,
    balance: result.balance,
    formatted: result.formatted
  }
}
