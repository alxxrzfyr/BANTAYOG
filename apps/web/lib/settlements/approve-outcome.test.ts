import { describe, expect, it } from "vitest";
import { approvalRelease, approveRecovery, isResultUnknown, settlementControls } from "./approve-outcome";
import { SettlementApiError } from "./api";

describe("isResultUnknown", () => {
  it("is true when no response arrived (timeout, network)", () => {
    expect(isResultUnknown(new SettlementApiError(0, null, "No connection"))).toBe(true);
    expect(isResultUnknown(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("is true for gateway and server errors", () => {
    for (const status of [408, 500, 502, 503, 504]) {
      expect(isResultUnknown(new SettlementApiError(status, null, "x"))).toBe(true);
    }
  });

  it("is false for a clear client rejection", () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isResultUnknown(new SettlementApiError(status, "x", "x"))).toBe(false);
    }
  });
});

describe("settlementControls", () => {
  it("keeps the original release selection on retry even if the timed-out request never arrived", () => {
    expect(approvalRelease(["new"], ["first"], true)).toEqual(["first"]);
    expect(approvalRelease(["first"], null, false)).toEqual(["first"]);
    expect(approvalRelease(["new"], null, true)).toEqual([]);
  });
  it("allows review only for an unapproved proposal", () => {
    expect(settlementControls("PROPOSED", false, false, false)).toEqual({ canApprove: true, canEdit: true });
  });

  it("locks all decisions during a request or unknown approval result", () => {
    expect(settlementControls("PROPOSED", true, false, false)).toEqual({ canApprove: false, canEdit: false });
    expect(settlementControls("PROPOSED", false, true, false)).toEqual({ canApprove: false, canEdit: false });
  });

  it("allows a safe approval retry but no release or reject after approval started", () => {
    expect(settlementControls("PROPOSED", false, false, true)).toEqual({ canApprove: true, canEdit: false });
  });

  it.each(["SENT", "PAID", "CANCELLED"] as const)("offers no decision for %s", (status) => {
    expect(settlementControls(status, false, false, false)).toEqual({ canApprove: false, canEdit: false });
  });
});

describe("approveRecovery", () => {
  it("offers a retry only when the refetched invoice is still PROPOSED", () => {
    const r = approveRecovery("PROPOSED");
    expect(r.locked).toBe(false);
    expect(r.message).toMatch(/still proposed/i);
    expect(r.message).not.toMatch(/not sent/i);
    expect(r.message).toMatch(/approve again/i);
  });

  it("does not claim the invoice was not sent when the invoice moved on", () => {
    for (const status of ["SENT", "PAID", "CANCELLED"] as const) {
      const r = approveRecovery(status);
      expect(r.locked).toBe(false);
      expect(r.message).not.toMatch(/not sent/i);
      expect(r.message).not.toMatch(/approve again/i);
    }
    expect(approveRecovery("SENT").message).toMatch(/was sent/i);
  });

  it("stays locked and says the result is unknown when the invoice could not be reloaded", () => {
    const r = approveRecovery(null);
    expect(r.locked).toBe(true);
    expect(r.message).toMatch(/not known/i);
  });
});
