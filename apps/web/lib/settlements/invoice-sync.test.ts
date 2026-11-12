import { describe, expect, it } from "vitest";
import { pendingProposal, pickDetail, sameInvoiceState, shouldRefetchDetail } from "./invoice-sync";
import type { MerchantSettlementOverviewDto, SettlementInvoiceDto } from "./types";

const inv = (patch: Partial<SettlementInvoiceDto> = {}): SettlementInvoiceDto => ({
  id: "inv-1",
  merchantId: "m-1",
  storeName: "Aling Nena Store",
  status: "PROPOSED",
  approved: false,
  totalAmountPhp: "100.00",
  heldAmountPhp: "0.00",
  aiSummary: "",
  paypalInvoiceId: null,
  payUrl: null,
  createdAt: "2026-11-12T06:00:00.000Z",
  sentAt: null,
  paidAt: null,
  ...patch,
});

const overview = (invoices: SettlementInvoiceDto[]): MerchantSettlementOverviewDto => ({
  unpaidSaleCount: 0,
  unpaidAmountPhp: "0.00",
  waitingForLedgerCount: 0,
  paidAmountPhp: "0.00",
  invoices,
});

describe("sameInvoiceState", () => {
  it("is true when total, held, status, sentAt and paidAt match", () => {
    expect(sameInvoiceState(inv(), inv({ aiSummary: "other text" }))).toBe(true);
  });

  it.each([
    ["totalAmountPhp", { totalAmountPhp: "120.00" }],
    ["heldAmountPhp", { heldAmountPhp: "20.00" }],
    ["status", { status: "SENT" as const }],
    ["sentAt", { sentAt: "2026-11-12T07:00:00.000Z" }],
    ["paidAt", { paidAt: "2026-11-12T08:00:00.000Z" }],
  ])("is false when %s differs", (_name, patch) => {
    expect(sameInvoiceState(inv(), inv(patch))).toBe(false);
  });
});

describe("pickDetail", () => {
  it("retires a proposal permanently once listed, even if that invoice later disappears", () => {
    let proposal: SettlementInvoiceDto | null = inv();
    proposal = pendingProposal(overview([]), proposal);
    expect(proposal?.id).toBe("inv-1");
    proposal = pendingProposal(overview([inv({ status: "CANCELLED" })]), proposal);
    expect(proposal).toBeNull();
    proposal = pendingProposal(overview([]), proposal);
    expect(proposal).toBeNull();
  });
  const lines = [] as NonNullable<SettlementInvoiceDto["lines"]>;

  it("keeps a cached detail that was fetched after the overview", () => {
    const cached = inv({ totalAmountPhp: "90.00", lines });
    const picked = pickDetail({ overview: overview([inv()]), overviewAt: 100, cached, cachedAt: 200, proposed: null });
    expect(picked).toBe(cached);
  });

  it("drops an older cached detail when the overview shows a changed total with the same status", () => {
    const cached = inv({ totalAmountPhp: "100.00", lines });
    const listed = inv({ totalAmountPhp: "150.00" });
    const picked = pickDetail({ overview: overview([listed]), overviewAt: 300, cached, cachedAt: 200, proposed: null });
    expect(picked).toBeNull();
  });

  it("drops an older cached SENT detail when the overview shows PAID", () => {
    const cached = inv({ status: "SENT", lines });
    const listed = inv({ status: "PAID", paidAt: "2026-11-12T08:00:00.000Z" });
    expect(pickDetail({ overview: overview([listed]), overviewAt: 300, cached, cachedAt: 200, proposed: null })).toBeNull();
  });

  it("keeps an older cached detail when nothing changed in the overview", () => {
    const cached = inv({ lines });
    const picked = pickDetail({ overview: overview([inv()]), overviewAt: 300, cached, cachedAt: 200, proposed: null });
    expect(picked).toBe(cached);
  });

  it("uses the mutation result while the overview does not list that invoice", () => {
    const proposed = inv({ id: "inv-new" });
    const picked = pickDetail({ overview: overview([]), overviewAt: 100, cached: undefined, cachedAt: 0, proposed });
    expect(picked).toBe(proposed);
  });

  it("ignores the mutation result once the overview lists that invoice id", () => {
    const proposed = inv({ id: "inv-new", status: "PROPOSED" });
    const listed = inv({ id: "inv-new", status: "CANCELLED" });
    const picked = pickDetail({ overview: overview([listed]), overviewAt: 100, cached: undefined, cachedAt: 0, proposed });
    expect(picked).toBeNull();
  });

  it("ignores the mutation result when the focused invoice is a different one", () => {
    const proposed = inv({ id: "inv-old" });
    const listed = inv({ id: "inv-old", status: "PAID" });
    expect(pickDetail({ overview: overview([listed]), overviewAt: 1, cached: undefined, cachedAt: 0, proposed })).toBeNull();
  });

  it("does not revive a missing old proposal when another invoice is active", () => {
    expect(pickDetail({ overview: overview([inv({ id: "other" })]), overviewAt: 300,
      cached: undefined, cachedAt: 0, proposed: inv({ id: "old" }) })).toBeNull();
  });

  it("uses the overview on a timestamp tie when its totals changed", () => {
    expect(pickDetail({ overview: overview([inv({ totalAmountPhp: "150.00" })]), overviewAt: 300,
      cached: inv(), cachedAt: 300, proposed: null })).toBeNull();
  });
});

describe("shouldRefetchDetail", () => {
  it("is true when the newer overview shows a changed invoice", () => {
    const listed = inv({ totalAmountPhp: "150.00" });
    expect(shouldRefetchDetail({ listed, cached: inv(), overviewAt: 300, cachedAt: 200 })).toBe(true);
  });

  it("is false when the states match", () => {
    expect(shouldRefetchDetail({ listed: inv(), cached: inv(), overviewAt: 300, cachedAt: 200 })).toBe(false);
  });

  it("is false when the detail is newer than the overview (no refetch loop)", () => {
    const listed = inv({ totalAmountPhp: "150.00" });
    expect(shouldRefetchDetail({ listed, cached: inv(), overviewAt: 200, cachedAt: 300 })).toBe(false);
  });

  it("is false when there is nothing to compare", () => {
    expect(shouldRefetchDetail({ listed: undefined, cached: inv(), overviewAt: 300, cachedAt: 200 })).toBe(false);
    expect(shouldRefetchDetail({ listed: inv(), cached: undefined, overviewAt: 300, cachedAt: 200 })).toBe(false);
  });
});
