import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WalletBalanceCard } from "./wallet-balance-card";

vi.mock("@/lib/chain/wallet-adapter", () => ({ pickWallet: vi.fn() }));
vi.mock("@/lib/api", () => ({ authFetch: vi.fn() }));

describe("WalletBalanceCard API balance", () => {
  it("shows only the PayPal logo and keeps the existing transfer action", () => {
    const html = renderToStaticMarkup(<WalletBalanceCard balance="12.0000000" walletAddress={null}
      connected={false} isLoading={false} isError={false} refetch={() => {}} />);
    expect(html).toContain('src="/paypal-logo.svg"');
    expect(html).toContain('aria-label="PayPal"');
    expect(html).not.toContain("PayPal (Demo)");
    expect(html).not.toContain("Simulation only");
    expect(html).not.toContain("<dialog");
    const button = html.match(/<button[^>]*>Transfer to Wallet<\/button>/)?.[0];
    expect(button).not.toContain('aria-haspopup="dialog"');
    expect(button).toContain(' disabled=""');
  });

  it.each([
    ["1234.5600000", "1234.56"],
    ["0.0000000", "0.00"],
    ["999.9999999", "999.9999999"],
    ["0.0000001", "0.0000001"],
  ])("renders the API decimal %s without number conversion", (balance, displayed) => {
    const html = renderToStaticMarkup(<WalletBalanceCard
      balance={balance} walletAddress={null} connected={false}
      isLoading={false} isError={false} refetch={() => {}}
    />);
    expect(html).toContain(`${displayed} <span`);
    expect(html).toContain(`= ₱${displayed} PHP`);
    expect(html.includes("Please connect a wallet to cash out your balance.")).toBe(balance !== "0.0000000");
  });
});
