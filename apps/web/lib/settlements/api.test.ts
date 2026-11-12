import { beforeEach, describe, expect, it, vi } from "vitest";

const authFetch = vi.fn();
vi.mock("@/lib/api", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import {
  approveSettlement,
  getMerchantSettlement,
  getMerchantSettlementOverview,
  getSettlement,
  listSettlements,
  refreshMerchantSettlement,
  refreshSettlement,
  rejectSettlement,
  requestMerchantSettlement,
  SettlementApiError,
} from "./api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = authFetch.mock.calls.at(-1) as [string, RequestInit | undefined];
  return { url, init: init ?? {} };
}

beforeEach(() => {
  authFetch.mockReset();
});

describe("merchant settlement endpoints", () => {
  it("GET /api/merchants/me/settlements returns the overview", async () => {
    const overview = { unpaidSaleCount: 2, unpaidAmountPhp: "10.00", waitingForLedgerCount: 0, paidAmountPhp: "0.00", invoices: [] };
    authFetch.mockImplementation(async () => jsonResponse(200, overview));

    await expect(getMerchantSettlementOverview()).resolves.toEqual(overview);
    const { url, init } = lastCall();
    expect(url).toBe("/api/merchants/me/settlements");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("POST /api/merchants/me/settlements accepts 201 and 200", async () => {
    authFetch.mockResolvedValueOnce(jsonResponse(201, { id: "inv-1" }));
    await expect(requestMerchantSettlement()).resolves.toEqual({ id: "inv-1" });
    expect(lastCall()).toMatchObject({ url: "/api/merchants/me/settlements", init: { method: "POST" } });

    authFetch.mockResolvedValueOnce(jsonResponse(200, { id: "inv-open" }));
    await expect(requestMerchantSettlement()).resolves.toEqual({ id: "inv-open" });
  });

  it("GET and refresh one merchant invoice, with the id encoded", async () => {
    authFetch.mockImplementation(async () => jsonResponse(200, { id: "a/b" }));

    await getMerchantSettlement("a/b");
    expect(lastCall().url).toBe("/api/merchants/me/settlements/a%2Fb");

    await refreshMerchantSettlement("inv-1");
    expect(lastCall()).toMatchObject({ url: "/api/merchants/me/settlements/inv-1/refresh", init: { method: "POST" } });
  });
});

describe("admin settlement endpoints", () => {
  it("lists settlements, with and without a status filter", async () => {
    authFetch.mockImplementation(async () => jsonResponse(200, []));

    await listSettlements();
    expect(lastCall().url).toBe("/api/settlements");

    await listSettlements("PROPOSED");
    expect(lastCall().url).toBe("/api/settlements?status=PROPOSED");
  });

  it("gets one settlement", async () => {
    authFetch.mockImplementation(async () => jsonResponse(200, { id: "inv-1" }));
    await getSettlement("inv-1");
    expect(lastCall().url).toBe("/api/settlements/inv-1");
  });

  it("approve sends the released sale ids as JSON", async () => {
    authFetch.mockImplementation(async () => jsonResponse(200, { id: "inv-1", status: "SENT" }));

    await approveSettlement("inv-1", ["tx-1", "tx-2"]);
    const { url, init } = lastCall();
    expect(url).toBe("/api/settlements/inv-1/approve");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({ releaseTransactionIds: ["tx-1", "tx-2"] });
  });

  it("approve with no release sends an empty body object", async () => {
    authFetch.mockImplementation(async () => jsonResponse(200, { id: "inv-1" }));
    await approveSettlement("inv-1", []);
    expect(JSON.parse(String(lastCall().init.body))).toEqual({});
  });

  it("reject sends the reason", async () => {
    authFetch.mockImplementation(async () => jsonResponse(200, { id: "inv-1", status: "CANCELLED" }));
    await rejectSettlement("inv-1", "Prices look wrong");
    const { url, init } = lastCall();
    expect(url).toBe("/api/settlements/inv-1/reject");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ reason: "Prices look wrong" });
  });

  it("refresh reads PayPal through the server", async () => {
    authFetch.mockImplementation(async () => jsonResponse(200, { id: "inv-1", status: "PAID" }));
    await refreshSettlement("inv-1");
    expect(lastCall()).toMatchObject({ url: "/api/settlements/inv-1/refresh", init: { method: "POST" } });
  });
});

describe("errors", () => {
  it("turns the error contract body into a typed error with the HTTP status", async () => {
    authFetch.mockImplementation(async () => jsonResponse(400, { error: "validation", message: "No eligible sales" }));

    const error = await requestMerchantSettlement().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SettlementApiError);
    expect(error).toMatchObject({ status: 400, tag: "validation", message: "No eligible sales" });
  });

  it("uses a fallback message when the body is not JSON", async () => {
    authFetch.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));

    const error = await getSettlement("inv-1").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, tag: null });
    expect((error as Error).message).toMatch(/502/);
  });

  it("wraps a network failure as status 0", async () => {
    authFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await listSettlements().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SettlementApiError);
    expect(error).toMatchObject({ status: 0 });
  });
});
