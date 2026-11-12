import type { MerchantSettlementOverviewDto, SettlementInvoiceDto } from "./types";

export function pendingProposal(overview: MerchantSettlementOverviewDto, proposed: SettlementInvoiceDto | null): SettlementInvoiceDto | null {
  return proposed && !overview.invoices.some((i) => i.id === proposed.id || i.status === "PROPOSED" || i.status === "SENT")
    ? proposed : null;
}

export function sameInvoiceState(a: SettlementInvoiceDto, b: SettlementInvoiceDto): boolean {
  return a.id === b.id && a.totalAmountPhp === b.totalAmountPhp && a.heldAmountPhp === b.heldAmountPhp &&
    a.status === b.status && a.sentAt === b.sentAt && a.paidAt === b.paidAt;
}

export function shouldRefetchDetail({ listed, cached, overviewAt, cachedAt }: {
  listed: SettlementInvoiceDto | undefined;
  cached: SettlementInvoiceDto | undefined;
  overviewAt: number;
  cachedAt: number;
}): boolean {
  return Boolean(listed && cached && overviewAt >= cachedAt && !sameInvoiceState(listed, cached));
}

export function pickDetail({ overview, overviewAt, cached, cachedAt, proposed }: {
  overview: MerchantSettlementOverviewDto;
  overviewAt: number;
  cached: SettlementInvoiceDto | undefined;
  cachedAt: number;
  proposed: SettlementInvoiceDto | null;
}): SettlementInvoiceDto | null {
  const listed = overview.invoices.find((i) => i.id === cached?.id);
  if (cached && listed) {
    return shouldRefetchDetail({ listed, cached, overviewAt, cachedAt }) ? null : cached;
  }
  // The page retires the POST result as soon as an overview lists its ID.
  return pendingProposal(overview, proposed);
}
