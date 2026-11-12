import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WalletBalanceCard } from "./wallet-balance-card";

vi.mock("@/lib/chain/wallet-adapter", () => ({ pickWallet: vi.fn() }));
vi.mock("@/lib/api", () => ({ authFetch: vi.fn() }));

describe("WalletBalanceCard API balance", () => {
  it.each(["0.0000000", "12.0000000"])("offers the PayPal demo without a connected wallet at balance %s", (balance) => {
    const html = renderToStaticMarkup(<WalletBalanceCard balance={balance} walletAddress={null}
      connected={false} isLoading={false} isError={false} refetch={() => {}} />);
    expect(html).toContain("PayPal (Demo)");
    expect(html).toContain("Simulation only. No funds move.");
    const button = html.match(/<button[^>]*>Transfer to Wallet<\/button>/)?.[0];
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).not.toContain(' disabled=""');
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
