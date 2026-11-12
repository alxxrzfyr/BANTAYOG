import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ authFetch: mocks.authFetch }));
import { createFundTopup, captureFundTopup, getFundLedger } from "./api";

const id = "f4ee46f7-d82e-4c9d-b1e3-febff1d73caf";
const receipt = { id, status: "COMPLETED", amountPhp: "50.00", feePhp: "16.70", netAmountPhp: "33.30", orderId: "5O190127TN364715T", captureId: "3C679366HH908993F", approvalUrl: null, createdAt: "2026-11-12T00:00:00Z", completedAt: "2026-11-12T00:01:00Z" };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("Fund API client", () => {
  it("uses guest fetch for create and capture, without a merchant credential", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(receipt)));
    vi.stubGlobal("fetch", fetcher);
    expect(await createFundTopup({ requestId: id, amountPhp: "50.00" })).toEqual(receipt);
    expect(await captureFundTopup(receipt.orderId)).toEqual(receipt);
    expect(fetcher.mock.calls[0]).toMatchObject(["/api/fund/topups", { method: "POST", body: JSON.stringify({ requestId: id, amountPhp: "50.00" }) }]);
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
    expect(mocks.authFetch).not.toHaveBeenCalled();
  });
  it("uses the admin session for the ledger and keeps SQL totals", async () => {
    const ledger = { grossContributionsPhp: "50.00", feesPhp: "16.70", netContributionsPhp: "33.30", grantsIssuedPhp: "100.00", grantCount: 1, confirmedSalesPhp: "75.00", paidInvoicesPhp: "50.00", owedPhp: "25.00", topups: [receipt] };
    mocks.authFetch.mockResolvedValue(new Response(JSON.stringify(ledger)));
    expect(await getFundLedger()).toEqual(ledger);
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/fund/ledger", expect.any(Object));
  });
  it("rejects malformed success responses and preserves safe server errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('{"status":"COMPLETED"}')).mockResolvedValueOnce(new Response(JSON.stringify({ error: "paypal", message: "Retry the same contribution." }), { status: 502 })));
    await expect(captureFundTopup(receipt.orderId)).rejects.toThrow("invalid response");
    await expect(captureFundTopup(receipt.orderId)).rejects.toThrow("Retry the same contribution.");
  });
})
