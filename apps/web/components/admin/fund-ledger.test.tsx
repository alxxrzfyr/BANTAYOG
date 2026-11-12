import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FundLedgerDto, FundTopupDto } from "@bantayog/schema";
import { FundLedgerView } from "./fund-ledger";
import { FundReceipt } from "@/components/fund/funder-checkout";
import FundPage from "@/app/fund/page";
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
const receipt: FundTopupDto = { id: "f4ee46f7-d82e-4c9d-b1e3-febff1d73caf", status: "COMPLETED", amountPhp: "50.00", feePhp: "16.70", netAmountPhp: "33.30", orderId: "5O190127TN364715T", captureId: "3C679366HH908993F", approvalUrl: null, createdAt: "2026-11-12T00:00:00Z", completedAt: "2026-11-12T00:01:00Z" };
describe("Fund receipt and ledger", () => {
  it("shows confirmed gross, fee and net separately without claiming a child received credits", () => {
    const html = renderToStaticMarkup(<FundReceipt receipt={receipt} />);
    expect(html).toContain("Contribution received");
    expect(html).toContain("₱50.00"); expect(html).toContain("₱16.70"); expect(html).toContain("₱33.30");
    expect(html).not.toMatch(/child received|credits issued/);
  });
  it("never turns an incomplete receipt into payment success", () => {
    const html = renderToStaticMarkup(<FundReceipt receipt={{ ...receipt, status: "CREATED" }} />);
    expect(html).toContain("Waiting for PayPal payment confirmation");
    expect(html).not.toContain("Contribution received");
  });
  it("presents Available to grant as main figure supplied by server with net contributions, backed grants, confirmed sales, invoices paid and owed", () => {
    const ledger: FundLedgerDto = {
      grossContributionsPhp: "1234.50",
      feesPhp: "16.70",
      netContributionsPhp: "1217.80",
      backedGrantsPhp: "200.00",
      availableToGrantPhp: "1017.80",
      grantsIssuedPhp: "5000.00",
      grantCount: 3,
      confirmedSalesPhp: "75.00",
      paidInvoicesPhp: "50.00",
      owedPhp: "25.00",
      topups: [receipt],
    };
    const html = renderToStaticMarkup(<FundLedgerView ledger={ledger} />);
    expect(html).toContain("Available to grant");
    expect(html).toContain("₱1,017.80");
    expect(html).toContain("Net contributions");
    expect(html).toContain("₱1,217.80");
    expect(html).toContain("Backed grants");
    expect(html).toContain("Backed grants include reserved funds and issued grants.");
    expect(html).toContain("₱200.00");
    expect(html).toContain("₱75.00");
    expect(html).toContain("₱50.00");
    expect(html).toContain("₱25.00");
    expect(html).toContain("This is not a cash balance");
    // Honest note that pre-rule grants do not reserve this pool
    expect(html).toContain("Pre-rule grants do not reserve this pool");
    expect(html).toContain("₱5,000.00");
    // Replaced stale copy
    expect(html).not.toContain("do not yet issue child credits or pay store invoices");
    expect(html).toContain("New grants are backed by net captured contributions");
  });

  it("funder checkout public form includes truthful static line about backed grants", () => {
    const html = renderToStaticMarkup(<FundPage />);
    expect(html).toContain("New grants of PHP 5,000 or PHP 3,500 are backed by net captured contributions.");
    expect(html).toContain("No captured PayPal money, no new grant.");
  });
});
