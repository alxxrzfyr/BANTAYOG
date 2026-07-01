/**
 * QR Token Service — signed JWT generation and verification.
 *
 * Uses `jose` (Edge-compatible JWT library).
 * Tokens expire after 30 days by default.
 * On verify, the beneficiary's tier is re-evaluated from current date.
 */

import { SignJWT, jwtVerify } from "jose";
import { getQrTokenSecret } from "@/lib/env";
import { computeTier, type Tier } from "@/lib/domain/eligibility";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QrTokenPayload {
  beneficiaryId: string;
  childName: string;
  guardianName: string;
  tier: Tier;
  pinHashRef: string;
}

export interface QrTokenResult {
  jwsCompact: string;
  cardSerial: string;
  expiresAt: Date;
}

export interface QrVerifyResult {
  valid: boolean;
  beneficiaryId: string | null;
  childName: string | null;
  guardianName: string | null;
  currentTier: Tier | null;
  expired: boolean;
  revoked: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY_DAYS = 30;

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getQrTokenSecret());
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/**
 * Generate a signed JWT for a beneficiary QR pass.
 *
 * @param payload  Beneficiary data to embed in the token.
 * @param cardSerial The card serial number to return alongside.
 * @returns QR token result with JWS compact string and expiry.
 */
export async function generateQrToken(
  payload: QrTokenPayload,
  cardSerial: string,
): Promise<QrTokenResult> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  const jwsCompact = await new SignJWT({
    beneficiaryId: payload.beneficiaryId,
    childName: payload.childName,
    guardianName: payload.guardianName,
    tier: payload.tier,
    pinHashRef: payload.pinHashRef,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return { jwsCompact, cardSerial, expiresAt };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify a QR token JWT and re-evaluate the beneficiary's tier.
 *
 * @param jwsCompact The signed JWT string (from QR code).
 * @param birthdate  The beneficiary's birthdate for tier re-evaluation.
 * @returns Verification result with current tier (re-computed) or failure flags.
 */
export async function verifyQrToken(
  jwsCompact: string,
  birthdate?: Date,
): Promise<QrVerifyResult> {
  try {
    const { payload } = await jwtVerify(jwsCompact, getSecret(), {
      clockTolerance: 60, // 1 minute clock skew
    });

    const result: QrVerifyResult = {
      valid: true,
      beneficiaryId: (payload.beneficiaryId as string) ?? null,
      childName: (payload.childName as string) ?? null,
      guardianName: (payload.guardianName as string) ?? null,
      currentTier: (payload.tier as Tier) ?? null,
      expired: false,
      revoked: false,
    };

    // Re-evaluate tier if birthdate is provided
    if (birthdate && result.beneficiaryId) {
      const { tier } = computeTier(birthdate);
      result.currentTier = tier;
    }

    return result;
  } catch (err) {
    const isExpired =
      err instanceof Error &&
      (err.message.includes("exp") || err.message.includes("expired"));

    return {
      valid: false,
      beneficiaryId: null,
      childName: null,
      guardianName: null,
      currentTier: null,
      expired: isExpired,
      revoked: false, // Revocation check deferred to DB lookup
    };
  }
}
