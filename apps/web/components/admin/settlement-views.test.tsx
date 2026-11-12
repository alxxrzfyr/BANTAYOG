import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettlementListView } from "./settlement-list";
import { SettlementDetailError, SettlementDetailSkeleton, SettlementDetailView, type SettlementDetailViewProps } from "./settlement-detail";
import type { SettlementInvoiceDto, SettlementLineDto } from "@/lib/settlements/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const HASH = "ab12cd34".repeat(8);

const line = (patch: Partial<SettlementLineDto> = {}): SettlementLineDto => ({
  transactionId: "aaaaaaaa-0000-0000-0000-000000000001",
  amountPhp: "0.10",
  soldAt: "2026-11-12T06:04:00.000Z",
  held: false,
  holdReason: null,
  ledgerTxHash: HASH,
  items: [
    { name: "Fortified rice 1 kg", category: "GRAINS", quantity: 2, unitPricePhp: "0.05", imageUrl: "https://img.example/rice.png" },
    { name: "Mung beans", category: "LEGUMES", quantity: 1, unitPricePhp: "0.00", imageUrl: null },
  ],
  ...patch,
});

const heldLine = line({
  transactionId: "hhhhhhhh-0000-0000-0000-000000000002",
  amountPhp: "85.00",
  held: true,
  holdReason: "Evaporated milk at ₱85.00 is above the ₱42.00 reference price.",
});

const invoice = (patch: Partial<SettlementInvoiceDto> = {}): SettlementInvoiceDto => ({
  id: "inv00001-aaaa-bbbb-cccc-000000000000",
  merchantId: "m-1",
  storeName: "Aling Nena Store",
  status: "PROPOSED",
  approved: false,
  // Not the sum of the line amounts on purpose.
  totalAmountPhp: "1234.50",
  heldAmountPhp: "85.00",
  aiSummary: "Two sales. One sale is held: evaporated milk is above its reference price.",
  paypalInvoiceId: null,
  payUrl: null,
  createdAt: "2026-11-12T06:00:00.000Z",
  sentAt: null,
  paidAt: null,
  lines: [line(), heldLine],
  ...patch,
});

function renderDetail(patch: Partial<SettlementDetailViewProps> = {}): string {
  const props: SettlementDetailViewProps = {
    invoice: invoice(),
    pending: null,
    actionError: null,
    notice: null,
    onApprove: () => {},
    onReject: () => {},
    onRefresh: () => {},
    ...patch,
  };
  return renderToStaticMarkup(<SettlementDetailView {...props} />);
}

describe("SettlementListView", () => {
  const list = [
    invoice({ id: "p-1", storeName: "Aling Nena Store" }),
    invoice({ id: "s-1", storeName: "Mang Tonyo Store", status: "SENT" }),
    invoice({ id: "x-1", storeName: "Cancelled Store", status: "CANCELLED" }),
  ];

  it("opens on claims that need review, with counts and links to the detail", () => {
    const html = renderToStaticMarkup(<SettlementListView invoices={list} loading={false} error={null} onRetry={() => {}} />);
    expect(html).toContain("Needs review");
    expect(html).toContain('href="/admin/settlements/p-1"');
    expect(html).not.toContain('href="/admin/settlements/s-1"');
    expect(html).toContain("₱1,234.50");
    expect(html).toMatch(/Needs review[\s\S]*?>1</);
  });

  it("empty filter explains that nothing waits for the officer", () => {
    const html = renderToStaticMarkup(
      <SettlementListView invoices={[list[1]]} loading={false} error={null} onRetry={() => {}} />,
    );
    expect(html).toContain("No claims need review");
  });

  it("loading shows a labelled skeleton", () => {
    const html = renderToStaticMarkup(<SettlementListView invoices={null} loading error={null} onRetry={() => {}} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading settlements");
  });

  it("error shows the message and a retry", () => {
    const html = renderToStaticMarkup(<SettlementListView invoices={null} loading={false} error="HTTP 502" onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("HTTP 502");
    expect(html).toContain("Try again");
  });
});

describe("SettlementDetailView", () => {
  it.each(["SENT", "PAID"] as const)("does not render an unsafe pay URL for %s", (status) => {
    const html = renderDetail({ invoice: invoice({ status, payUrl: "https://paypal.com.evil.test/pay" }) });
    expect(html).not.toContain('href="https://paypal.com.evil.test/pay"');
    expect(html).toContain("The pay link is not available.");
  });

  it.each([null, "INV2-DRAFT"])("does not offer release or rejection for an approved proposal with draft %s", (paypalInvoiceId) => {
    const html = renderDetail({ invoice: invoice({ approved: true, paypalInvoiceId }) });
    expect(html).not.toContain("Include this sale in the payment");
    expect(html).not.toContain("Reject claim");
    expect(html).toContain("Approve");
  });
  it("proposed: the approve action states exactly what will happen, with the API total", () => {
    const html = renderDetail();
    expect(html).toContain("Creates and sends a PayPal invoice for ₱1,234.50");
    expect(html).toContain("Approve and send invoice");
    expect(html).toContain("Reject claim");
    // The browser never adds line amounts (0.10 + 85.00).
    expect(html).not.toContain("₱85.10");
  });

  it("shows the AI summary and marks it as AI-written", () => {
    const html = renderDetail();
    expect(html).toContain("Two sales. One sale is held");
    expect(html).toContain("Written by AI");
  });

  it("shows the proof for each sale: time, items with image, unit price and ledger hash link", () => {
    const html = renderDetail();
    expect(html).toContain("Nov 12, 2026, 2:04 PM");
    expect(html).toContain("Fortified rice 1 kg");
    expect(html).toContain('src="https://img.example/rice.png"');
    expect(html).toContain("2 × ₱0.05");
    expect(html).toContain(`href="https://stellar.expert/explorer/testnet/tx/${HASH}"`);
    expect(html).toContain("ab12cd…12cd34");
  });

  it("held sales are separate, explain why and offer a release control", () => {
    const html = renderDetail();
    expect(html).toContain("Held for review");
    expect(html).toContain("Evaporated milk at ₱85.00 is above the ₱42.00 reference price.");
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
    expect(html).toContain("Include this sale in the payment");
  });

  it("a sale without a ledger hash says so", () => {
    const html = renderDetail({ invoice: invoice({ lines: [line({ ledgerTxHash: null })] }) });
    expect(html).toContain("No ledger hash");
  });

  it("approve in progress disables the actions and says what is happening", () => {
    const html = renderDetail({ pending: "approve" });
    expect(html).toContain("Sending invoice…");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Sending invoice…/);
  });

  it("sent: shows the PayPal pay link and a status refresh, no approve", () => {
    const html = renderDetail({
      invoice: invoice({ status: "SENT", payUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-XXXX", sentAt: "2026-11-12T07:00:00.000Z" }),
    });
    expect(html).toContain('href="https://www.sandbox.paypal.com/invoice/p/#INV2-XXXX"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Check payment status");
    expect(html).not.toContain("Approve and send invoice");
    expect(html).not.toMatch(/type="checkbox"/);
  });

  it("paid: shows the paid time", () => {
    const html = renderDetail({ invoice: invoice({ status: "PAID", paidAt: "2026-11-12T08:00:00.000Z" }) });
    expect(html).toContain("Paid");
    expect(html).toContain("Nov 12, 2026, 4:00 PM");
    expect(html).not.toContain("Approve and send invoice");
  });

  it("cancelled: closed, no actions", () => {
    const html = renderDetail({ invoice: invoice({ status: "CANCELLED" }) });
    expect(html).toContain("Not approved");
    expect(html).not.toContain("Approve and send invoice");
    expect(html).not.toContain("Check payment status");
  });

  it("action error is announced", () => {
    const html = renderDetail({ actionError: "PayPal did not answer. Nothing was sent." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("PayPal did not answer. Nothing was sent.");
  });

  it("has a status region", () => {
    const html = renderDetail();
    expect(html).toMatch(/role="status"[^>]*>[^<]*Waiting for your review/);
  });

  it("skeleton and error states", () => {
    expect(renderToStaticMarkup(<SettlementDetailSkeleton />)).toContain("Loading settlement");
    const err = renderToStaticMarkup(<SettlementDetailError message="Not found" onRetry={() => {}} />);
    expect(err).toContain('role="alert"');
    expect(err).toContain("Try again");
    expect(err).toContain('href="/admin/settlements"');
  });
});
