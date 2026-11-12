// PayPal settlement DTOs from docs/designs/paypal-settlement.md section 6.
// FE owns this file. Types come from the shared API contract in @bantayog/schema.
// All money values are strings with 2 decimals. The web app shows them as they arrive.
export type {
  SettlementStatus,
  SettlementItemDto as SettlementLineItemDto,
  SettlementLineDto,
  SettlementInvoiceDto,
  MerchantSettlementOverviewDto,
} from "@bantayog/schema";
