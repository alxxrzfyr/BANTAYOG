// Picks which "Get paid" screen state to show from the API overview.
// Display routing only: the counts and statuses come from the server as they are.

import type { MerchantSettlementOverviewDto, SettlementInvoiceDto } from "./types";

export type MerchantStage =
  /** A PROPOSED or SENT invoice is open */
  | { kind: "active"; invoice: SettlementInvoiceDto }
  /** The newest invoice is PAID and nothing new is unpaid */
  | { kind: "paid"; invoice: SettlementInvoiceDto }
  | { kind: "ready"; lastClosed: SettlementInvoiceDto | null }
  | { kind: "waiting"; lastClosed: SettlementInvoiceDto | null }
  | { kind: "empty"; lastClosed: SettlementInvoiceDto | null };

export function merchantStage(overview: MerchantSettlementOverviewDto): MerchantStage {
  const open = overview.invoices.find((i) => i.status === "PROPOSED" || i.status === "SENT");
  if (open) return { kind: "active", invoice: open };

  const lastClosed = overview.invoices[0] ?? null;
  if (overview.unpaidSaleCount > 0) return { kind: "ready", lastClosed };
  if (lastClosed?.status === "PAID") return { kind: "paid", invoice: lastClosed };
  if (overview.waitingForLedgerCount > 0) return { kind: "waiting", lastClosed };
  return { kind: "empty", lastClosed };
}
