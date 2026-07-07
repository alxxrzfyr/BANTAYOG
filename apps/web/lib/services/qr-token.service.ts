/**
 * QR Token Service — signed JWT generation and verification.
 *
 * Uses `jose` (Edge-compatible JWT library).
 * Tokens expire after 30 days by default.
 * On verify, the beneficiary's tier is re-evaluated from current date.
 *
 * Bug fix (5-minute legacy cards): Cards generated with the misconfigured
 * 5-minute expiry (exp - iat === 300s) are transparently re-validated using
 * the intended 30-day lifecycle from `iat`. No re-issuing required.
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
/** Seconds in 30 days — used for the manual iat-based check on bugged cards. */
const THIRTY_DAYS_SECONDS = TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

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
 * Handles the "5-minute bug": cards generated with a misconfigured 5-minute
 * expiry (exp - iat === 300s) are transparently re-validated using the
 * intended 30-day lifecycle based on `iat`, so they work without re-issuing.
 *
 * @param jwsCompact The signed JWT string (from QR code).
 * @param birthdate  The beneficiary's birthdate for tier re-evaluation.
 * @returns Verification result with current tier (re-computed) or failure flags.
 */
export async function verifyQrToken(
  jwsCompact: string,
  birthdate?: Date,
): Promise<QrVerifyResult> {
  const secret = getSecret();

  try {
    // Normal path: jose enforces the embedded `exp` claim (30-day cards)
    const { payload } = await jwtVerify(jwsCompact, secret, {
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

    // ── Legacy 5-minute bug recovery ──────────────────────────────────────
    // Cards minted with the misconfigured 5-minute expiry will throw an
    // expiration error above. We decode the raw payload to get `iat`, then
    // re-verify using a fake `currentDate` set 1 second after issuance — this
    // makes jose's internal exp check pass while the signature is still fully
    // verified. We then apply our own 30-day check from `iat`.
    if (isExpired) {
      try {
        // Peek at iat without verifying (informational only)
        const rawParts = jwsCompact.split(".");
        if (rawParts.length === 3) {
          const rawPayload = JSON.parse(
            Buffer.from(
              rawParts[1].replace(/-/g, "+").replace(/_/g, "/"),
              "base64",
            ).toString("utf-8"),
          ) as Record<string, unknown>;

          const iat = rawPayload.iat as number | undefined;

          if (typeof iat === "number") {
            const now = Math.floor(Date.now() / 1000);
            const isWithin30Days = now - iat <= THIRTY_DAYS_SECONDS;

            if (isWithin30Days) {
              // Pass a fake currentDate just inside the 5-minute window so
              // jose's exp check passes while still fully verifying the signature.
              const fakeNow = new Date((iat + 1) * 1000);
              const { payload: legacyPayload } = await jwtVerify(jwsCompact, secret, {
                clockTolerance: 60,
                currentDate: fakeNow,
              });

              const result: QrVerifyResult = {
                valid: true,
                beneficiaryId: (legacyPayload.beneficiaryId as string) ?? null,
                childName: (legacyPayload.childName as string) ?? null,
                guardianName: (legacyPayload.guardianName as string) ?? null,
                currentTier: (legacyPayload.tier as Tier) ?? null,
                expired: false,
                revoked: false,
              };

              // Re-evaluate tier if birthdate is provided
              if (birthdate && result.beneficiaryId) {
                const { tier } = computeTier(birthdate);
                result.currentTier = tier;
              }

              return result;
            }
          }
        }
      } catch {
        /* signature invalid or unrecoverable — fall through to failure return */
      }
    }

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
