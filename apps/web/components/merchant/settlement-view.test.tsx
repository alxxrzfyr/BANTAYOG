import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MerchantSettlementError,
  MerchantSettlementSkeleton,
  MerchantSettlementView,
  type MerchantSettlementViewProps,
} from "./settlement-view";
import type { MerchantSettlementOverviewDto, SettlementInvoiceDto, SettlementLineDto } from "@/lib/settlements/types";
import { pickDetail } from "@/lib/settlements/invoice-sync";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const line = (patch: Partial<SettlementLineDto> = {}): SettlementLineDto => ({
  transactionId: "aaaaaaaa-0000-0000-0000-000000000001",
  amountPhp: "0.10",
  soldAt: "2026-11-12T06:04:00.000Z",
  held: false,
  holdReason: null,
  ledgerTxHash: "f".repeat(64),
  items: [{ name: "Fortified rice 1 kg", category: "GRAINS", quantity: 1, unitPricePhp: "0.10", imageUrl: null }],
  ...patch,
});

const invoice = (patch: Partial<SettlementInvoiceDto> = {}): SettlementInvoiceDto => ({
  id: "inv00001-aaaa-bbbb-cccc-000000000000",
  merchantId: "m-1",
  storeName: "Aling Nena Store",
  status: "PROPOSED",
  approved: false,
  // Deliberately not the sum of the line amounts: the screen must show the API value.
  totalAmountPhp: "1234.50",
  heldAmountPhp: "0.00",
  aiSummary: "Three sales, all within reference prices.",
  paypalInvoiceId: null,
  payUrl: null,
  createdAt: "2026-11-12T06:00:00.000Z",
  sentAt: null,
  paidAt: null,
  ...patch,
});

const overview = (patch: Partial<MerchantSettlementOverviewDto> = {}): MerchantSettlementOverviewDto => ({
  unpaidSaleCount: 0,
  unpaidAmountPhp: "0.00",
  waitingForLedgerCount: 0,
  paidAmountPhp: "0.00",
  invoices: [],
  ...patch,
});

function render(patch: Partial<MerchantSettlementViewProps>): string {
  const props: MerchantSettlementViewProps = {
    overview: overview(),
    invoice: null,
    invoiceError: null,
    proposing: false,
    checking: false,
    actionError: null,
    notice: null,
    onGetPaid: () => {},
    onCheckStatus: () => {},
    onReload: () => {},
    ...patch,
  };
  return renderToStaticMarkup(<MerchantSettlementView {...props} />);
}

describe("MerchantSettlementView", () => {
  it("clearly says funder paid program through PayPal and store payout is separate step in announcement and body without claiming local payout or GCash", () => {
    const paid = invoice({ status: "PAID", totalAmountPhp: "1500.00", paidAt: "2026-11-12T08:00:00.000Z" });
    const html = render({ overview: overview({ invoices: [paid] }) });
    expect(html).toContain("The funder paid the program through PayPal. Store payout is a separate step handled by your program.");
    expect(html).toMatch(/role="status"[^>]*>[^<]*The funder paid the program through PayPal\. Store payout is a separate step handled by your program\./);
    expect(html).not.toMatch(/GCash|gcash/i);
    expect(html).not.toMatch(/You have been paid|The money is yours|on its way to you|Paid to you/);
  });

  it("describes the paid invoice amount and possible fee without promising merchant receipt", () => {
    const paid = invoice({ status: "PAID" });
    const html = render({ overview: overview({ invoices: [paid] }) });
    expect(html).toContain("PayPal invoice paid");
    expect(html).toContain("invoice amount");
    expect(html).toContain("PayPal can deduct its fee");
    expect(html).not.toMatch(/You have been paid|The money is yours|on its way to you|Paid to you/);
  });

  it("offers a ledger reload while keeping the paid moment", () => {
    const html = render({ overview: overview({ invoices: [invoice({ status: "PAID" })], waitingForLedgerCount: 2 }) });
    expect(html).toContain("still being confirmed");
    expect(html).toContain("Check again");
  });

  it.each([0, 1])("shows the cancellation reason from detail lines with %s unpaid sales", (unpaidSaleCount) => {
    const cancelled = invoice({ status: "CANCELLED", lines: [line({ held: true, holdReason: "Please check the store receipts." })] });
    const html = render({ overview: overview({ unpaidSaleCount, invoices: [cancelled] }), invoice: cancelled });
    expect(html).toContain("Your last claim was not approved");
    expect(html).toContain("Please check the store receipts.");
  });
  it("nothing to claim: shows the API amount and points to the next step, no Get paid button", () => {
    const html = render({});
    expect(html).toContain("Nothing to claim yet");
    expect(html).toContain("₱0.00");
    expect(html).toContain('href="/cart"');
    expect(html).not.toContain(">Get paid<");
  });

  it("waiting for ledger: says how many sales wait and offers a re-check", () => {
    const html = render({ overview: overview({ waitingForLedgerCount: 2 }) });
    expect(html).toContain("2 sales are waiting for ledger confirmation");
    expect(html).toContain("Check again");
  });

  it("ready: the hero is the unpaid amount from the API and Get paid is a large button", () => {
    const html = render({ overview: overview({ unpaidSaleCount: 3, unpaidAmountPhp: "4500.00" }) });
    expect(html).toContain("₱4,500.00");
    expect(html).toContain("3 confirmed sales");
    expect(html).not.toContain("then pays you through PayPal");
    expect(html).toContain("Store payout is a separate step handled by your program.");
    expect(html).toMatch(/<button[^>]*min-h-\[52px\][^>]*>.*Get paid/);
  });

  it("proposal in progress: busy region with assembling rows", () => {
    const html = render({ overview: overview({ unpaidSaleCount: 3, unpaidAmountPhp: "4500.00" }), proposing: true });
    expect(html).toContain("Preparing your claim");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(">Get paid<");
  });

  it("proposed: shows the invoice total as returned (not a sum of lines) and who acts next", () => {
    const detail = invoice({ lines: [line(), line({ transactionId: "bbbbbbbb-1", amountPhp: "0.20" })] });
    const html = render({ overview: overview({ invoices: [invoice()] }), invoice: detail });
    expect(html).toContain("₱1,234.50");
    expect(html).not.toContain("₱0.30");
    expect(html).toContain("Waiting for the program officer");
    expect(html).toContain("Sale aaaaaaaa");
  });

  it("proposed straight from the POST response, before the overview lists it", () => {
    const html = render({ overview: overview({ unpaidSaleCount: 1 }), invoice: invoice({ lines: [line()] }) });
    expect(html).toContain("Waiting for the program officer");
  });

  it("held sales are listed apart with their reason", () => {
    const detail = invoice({
      heldAmountPhp: "85.00",
      lines: [line(), line({ transactionId: "cccccccc-1", held: true, holdReason: "Milk priced above the reference price.", amountPhp: "85.00" })],
    });
    const html = render({ overview: overview({ invoices: [invoice()] }), invoice: detail });
    expect(html).toContain("Held for review");
    expect(html).toContain("Milk priced above the reference price.");
    expect(html).toContain("₱85.00");
  });

  it("sent: waits for payment and offers a status check", () => {
    const sent = invoice({ status: "SENT", sentAt: "2026-11-12T07:00:00.000Z" });
    const html = render({ overview: overview({ invoices: [sent] }), invoice: { ...sent, lines: [line()] } });
    expect(html).toContain("Waiting for payment");
    expect(html).toContain("Check payment status");
  });

  it("paid: shows the paid moment with the amount", () => {
    const paid = invoice({ status: "PAID", paidAt: "2026-11-12T08:00:00.000Z" });
    const html = render({ overview: overview({ paidAmountPhp: "1234.50", invoices: [paid] }) });
    expect(html).toContain("Paid");
    expect(html).toContain("₱1,234.50");
    expect(html).toContain("Nov 12, 2026, 4:00 PM");
    expect(html).toContain("Paid invoice total so far");
  });

  it("paid hero does not repeat the held amount", () => {
    const paid = invoice({ status: "PAID", heldAmountPhp: "85.00", paidAt: "2026-11-12T08:00:00.000Z" });
    const html = render({ overview: overview({ paidAmountPhp: "1234.50", invoices: [paid] }) });
    expect(html).not.toContain("held for review, not included");
  });

  it("a refreshed PAID detail wins over a stale SENT overview", () => {
    const sent = invoice({ status: "SENT" });
    const html = render({ overview: overview({ invoices: [sent] }), invoice: { ...sent, status: "PAID", paidAt: "2026-11-12T08:00:00.000Z" } });
    expect(html).toContain("PayPal invoice paid");
  });

  it("a fresher PAID overview wins over a cached SENT detail", () => {
    const sent = invoice({ status: "SENT", lines: [line()] });
    const paid = invoice({ status: "PAID", paidAt: "2026-11-12T08:00:00.000Z" });
    const latest = overview({ invoices: [paid] });
    const detail = pickDetail({ overview: latest, overviewAt: 2, cached: sent, cachedAt: 1, proposed: null });
    const html = render({ overview: latest, invoice: detail });
    expect(html).toContain("PayPal invoice paid");
    expect(html).not.toContain("Waiting for payment");
  });

  it("a rejected claim in the overview wins over the cached PROPOSED response", () => {
    const proposed = invoice({ status: "PROPOSED", lines: [line()] });
    const cancelled = invoice({ status: "CANCELLED" });
    const latest = overview({ unpaidSaleCount: 2, invoices: [cancelled] });
    const detail = pickDetail({ overview: latest, overviewAt: 2, cached: proposed, cachedAt: 1, proposed });
    const html = render({ overview: latest, invoice: detail });
    expect(html).toContain("Your last claim was not approved");
    expect(html).not.toContain("Waiting for the program officer");
  });

  it("shows a newer overview total while changed detail is being reloaded", () => {
    const latest = overview({ invoices: [invoice({ totalAmountPhp: "1500.00" })] });
    const detail = pickDetail({ overview: latest, overviewAt: 2, cached: invoice(), cachedAt: 1, proposed: null });
    const html = render({ overview: latest, invoice: detail });
    expect(html).toContain("₱1,500.00");
    expect(html).not.toContain("₱1,234.50");
  });

  it("action error is announced and offers a retry", () => {
    const html = render({ overview: overview({ unpaidSaleCount: 1 }), actionError: "No connection to the server." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("No connection to the server.");
    expect(html).toContain("Try again");
  });

  it("a cancelled last claim is explained", () => {
    const html = render({ overview: overview({ unpaidSaleCount: 1, invoices: [invoice({ status: "CANCELLED" })] }) });
    expect(html).toContain("Your last claim was not approved");
  });

  it("has a polite status region describing the state", () => {
    const html = render({ overview: overview({ unpaidSaleCount: 3, unpaidAmountPhp: "4500.00" }) });
    expect(html).toMatch(/role="status"[^>]*>[^<]*₱4,500.00 is ready to claim/);
  });
});

describe("MerchantSettlementSkeleton and MerchantSettlementError", () => {
  it("skeleton is a labelled busy status", () => {
    const html = renderToStaticMarkup(<MerchantSettlementSkeleton />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your claims");
  });

  it("error shows the message and a retry button", () => {
    const html = renderToStaticMarkup(<MerchantSettlementError message="Server is down." onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Server is down.");
    expect(html).toContain("Try again");
  });
});
