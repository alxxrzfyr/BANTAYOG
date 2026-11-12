import { describe, expect, it, vi } from "vitest";
import { clearMerchantToken, isAdminEndpoint, MERCHANT_TOKEN_KEY, MERCHANT_REFRESH_TOKEN_KEY } from "./api";
import { clearPinHash, getPinHash, hasPin, storePinHash } from "@/stores/pin-store";

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
