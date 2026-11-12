import { describe, expect, it } from "vitest";
import { isAdminEndpoint } from "./api";

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
