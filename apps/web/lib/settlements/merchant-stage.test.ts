import { describe, expect, it } from "vitest";
import { merchantStage } from "./merchant-stage";
import type { MerchantSettlementOverviewDto, SettlementInvoiceDto } from "./types";

function invoice(status: SettlementInvoiceDto["status"], id = `inv-${status}`): SettlementInvoiceDto {
  return {
    id,
    merchantId: "m-1",
    storeName: "Aling Nena Store",
    status,
    approved: status === "SENT" || status === "PAID",
    totalAmountPhp: "100.00",
    heldAmountPhp: "0.00",
    aiSummary: "Summary",
    paypalInvoiceId: null,
    payUrl: null,
    createdAt: "2026-11-12T06:00:00.000Z",
    sentAt: null,
    paidAt: null,
  };
}

function overview(patch: Partial<MerchantSettlementOverviewDto> = {}): MerchantSettlementOverviewDto {
  return {
    unpaidSaleCount: 0,
    unpaidAmountPhp: "0.00",
    waitingForLedgerCount: 0,
    paidAmountPhp: "0.00",
    invoices: [],
    ...patch,
  };
}

describe("merchantStage", () => {
  it("is empty when the API reports nothing", () => {
    expect(merchantStage(overview())).toEqual({ kind: "empty", lastClosed: null });
  });

  it("is waiting when only unconfirmed sales exist", () => {
    expect(merchantStage(overview({ waitingForLedgerCount: 2 })).kind).toBe("waiting");
  });

  it("is ready when the API reports unpaid sales", () => {
    expect(merchantStage(overview({ unpaidSaleCount: 3, waitingForLedgerCount: 1 })).kind).toBe("ready");
  });

  it("an open invoice wins over unpaid sales", () => {
    const open = invoice("SENT");
    const stage = merchantStage(overview({ unpaidSaleCount: 3, invoices: [open, invoice("PAID")] }));
    expect(stage).toEqual({ kind: "active", invoice: open });
  });

  it("finds a PROPOSED invoice even when it is not the newest", () => {
    const proposed = invoice("PROPOSED");
    const stage = merchantStage(overview({ invoices: [invoice("CANCELLED"), proposed] }));
    expect(stage).toEqual({ kind: "active", invoice: proposed });
  });

  it("is paid when the newest invoice is PAID and nothing new is unpaid", () => {
    const paid = invoice("PAID");
    expect(merchantStage(overview({ invoices: [paid] }))).toEqual({ kind: "paid", invoice: paid });
  });

  it("new unpaid sales after a payout make the stage ready and keep the last closed invoice", () => {
    const paid = invoice("PAID");
    expect(merchantStage(overview({ unpaidSaleCount: 1, invoices: [paid] }))).toEqual({ kind: "ready", lastClosed: paid });
  });

  it("reports a cancelled newest invoice so the screen can explain it", () => {
    const cancelled = invoice("CANCELLED");
    expect(merchantStage(overview({ unpaidSaleCount: 2, invoices: [cancelled] }))).toEqual({ kind: "ready", lastClosed: cancelled });
  });
});
