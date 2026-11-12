import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch, clearMerchantToken, isAdminEndpoint, MERCHANT_TOKEN_KEY, MERCHANT_REFRESH_TOKEN_KEY } from "./api";
import { clearPinHash, getPinHash, hasPin, storePinHash } from "@/stores/pin-store";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({ auth: { getSession: mocks.getSession } }),
}));

describe("transaction request credentials", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    const values = new Map([[MERCHANT_TOKEN_KEY, "merchant-access-token"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue(Response.json({ data: [], count: 0 }));
    mocks.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["recent sales", "/api/transactions?limit=4", "GET"],
    ["full sales history", "/api/transactions?limit=101", "GET"],
    ["checkout", "/api/transactions", "POST"],
  ])("sends the merchant token for %s without an admin session", async (_name, url, method) => {
    const options = { method, session: "merchant" as const };
    await authFetch(url, options);

    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer merchant-access-token" }),
    }));
  });

  it("keeps the merchant token when an admin is also signed in", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "admin-access-token" } }, error: null });
    const options = { session: "merchant" as const };
    await authFetch("/api/transactions?limit=4", options);

    expect(fetchMock).toHaveBeenCalledWith("/api/transactions?limit=4", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer merchant-access-token" }),
    }));
  });

  it("keeps admin transaction requests on the admin session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "admin-access-token" } }, error: null });
    await authFetch("/api/transactions?merchantId=store-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/transactions?merchantId=store-1", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer admin-access-token" }),
    }));
  });

  it("does not use a merchant token for an admin request without an admin session", async () => {
    await authFetch("/api/transactions?summary=1");

    expect(fetchMock).toHaveBeenCalledWith("/api/transactions?summary=1", expect.objectContaining({ headers: {} }));
  });

  it("does not use an admin session when the merchant token is missing", async () => {
    window.localStorage.removeItem(MERCHANT_TOKEN_KEY);
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "admin-access-token" } }, error: null });
    await authFetch("/api/transactions?limit=4", { session: "merchant" });

    expect(fetchMock).toHaveBeenCalledWith("/api/transactions?limit=4", { headers: {} });
  });

  it("uses the refreshed merchant token for history", async () => {
    window.localStorage.setItem(MERCHANT_TOKEN_KEY + "_expires", "1");
    window.localStorage.setItem(MERCHANT_REFRESH_TOKEN_KEY, "merchant-refresh-token");
    fetchMock.mockResolvedValueOnce(Response.json({ session: {
      accessToken: "refreshed-merchant-token", expiresAt: 4_000_000_000,
    } }));
    await authFetch("/api/transactions?limit=4", { session: "merchant" });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/transactions?limit=4", {
      headers: { Authorization: "Bearer refreshed-merchant-token" },
    });
  });

  it("does not use an admin session after merchant refresh fails", async () => {
    window.localStorage.setItem(MERCHANT_TOKEN_KEY + "_expires", "1");
    window.localStorage.setItem(MERCHANT_REFRESH_TOKEN_KEY, "merchant-refresh-token");
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "admin-access-token" } }, error: null });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await authFetch("/api/transactions?limit=4", { session: "merchant" });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/transactions?limit=4", { headers: {} });
    expect(window.localStorage.getItem(MERCHANT_TOKEN_KEY)).toBeNull();
  });

  it("forwards checkout options without forwarding the session selector", async () => {
    const controller = new AbortController();
    await authFetch("/api/transactions", {
      session: "merchant", method: "POST", body: "{}",
      headers: { "Content-Type": "application/json" }, signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/transactions", {
      method: "POST", body: "{}", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer merchant-access-token" },
    });
  });
});

describe("merchant PIN persistence", () => {
  it("keeps the saved PIN when a session ends and clears it only on reset", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    try {
      storePinHash("saved-pin-hash");
      for (const key of [MERCHANT_TOKEN_KEY, MERCHANT_REFRESH_TOKEN_KEY, MERCHANT_TOKEN_KEY + "_expires"]) {
        window.localStorage.setItem(key, "session-value");
      }
      clearMerchantToken();
      expect(getPinHash()).toBe("saved-pin-hash");
      for (const key of [MERCHANT_TOKEN_KEY, MERCHANT_REFRESH_TOKEN_KEY, MERCHANT_TOKEN_KEY + "_expires"]) {
        expect(window.localStorage.getItem(key)).toBeNull();
      }
      window.localStorage.setItem(MERCHANT_TOKEN_KEY, "next-session");
      expect(hasPin()).toBe(true);
      clearPinHash();
      expect(hasPin()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("isAdminEndpoint", () => {
  it("uses the admin session only for the fund ledger", () => {
    expect(isAdminEndpoint("/api/fund/ledger")).toBe(true);
    expect(isAdminEndpoint("/api/fund/ledger?x=1")).toBe(true);
    expect(isAdminEndpoint("/api/fund/ledgerX")).toBe(false);
    expect(isAdminEndpoint("/api/fund/topups")).toBe(false);
  });
  it("routes the admin settlement endpoints through the admin session", () => {
    expect(isAdminEndpoint("/api/settlements")).toBe(true);
    expect(isAdminEndpoint("/api/settlements?status=PROPOSED")).toBe(true);
    expect(isAdminEndpoint("/api/settlements/inv-1/approve")).toBe(true);
  });

  it("keeps the merchant settlement endpoints on the merchant token", () => {
    expect(isAdminEndpoint("/api/merchants/me/settlements")).toBe(false);
    expect(isAdminEndpoint("/api/merchants/me/settlements/inv-1/refresh")).toBe(false);
  });

  it("matches complete path segments and ignores queries and trailing slashes", () => {
    expect(isAdminEndpoint("/api/settlements/?status=SENT")).toBe(true);
    expect(isAdminEndpoint("/api/settlementsX")).toBe(false);
    expect(isAdminEndpoint("/api/merchants/me/?x=1")).toBe(false);
    expect(isAdminEndpoint("/api/merchants/me")).toBe(false);
    expect(isAdminEndpoint("/api/merchants/meX")).toBe(true);
    expect(isAdminEndpoint("/api/merchants/merchants")).toBe(true);
  });
});
