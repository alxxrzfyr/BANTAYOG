import { describe, it, expect, vi } from "vitest";
import { generateQrToken, verifyQrToken } from "./qr-token.service";
import type { QrTokenPayload } from "./qr-token.service";

vi.mock("@/lib/env", () => ({
  getQrTokenSecret: () => "test-secret-for-qr-tokens-only-32b",
}));

describe("qr-token.service", () => {
  const payload: QrTokenPayload = {
    beneficiaryId: "550e8400-e29b-41d4-a716-446655440000",
    childName: "Juan Dela Cruz",
    guardianName: "Maria Dela Cruz",
    tier: 1,
    pinHashRef: "$argon2id$v=19$m=65536,t=3,p=4$...",
  };

  it("generates a signed JWT with card serial", async () => {
    const result = await generateQrToken(payload, "BTG-2026-001");
    expect(result.jwsCompact).toContain(".");
    expect(result.cardSerial).toBe("BTG-2026-001");
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("verifies a valid token and returns payload fields", async () => {
    const result = await generateQrToken(payload, "BTG-2026-002");
    const verified = await verifyQrToken(result.jwsCompact);
    expect(verified.valid).toBe(true);
    expect(verified.beneficiaryId).toBe(payload.beneficiaryId);
    expect(verified.childName).toBe(payload.childName);
    expect(verified.guardianName).toBe(payload.guardianName);
    expect(verified.currentTier).toBe(payload.tier);
    expect(verified.expired).toBe(false);
  });

  it("detects an invalid signature", async () => {
    // Generate with the mocked secret, then verify with a tampered token
    const result = await generateQrToken(payload, "BTG-2026-003");
    const tampered = result.jwsCompact.slice(0, -5) + "xxxxx";
    const verified = await verifyQrToken(tampered);
    expect(verified.valid).toBe(false);
  });

  it("detects a completely malformed token", async () => {
    const verified = await verifyQrToken("invalid.jwt.token");
    expect(verified.valid).toBe(false);
  });
});
