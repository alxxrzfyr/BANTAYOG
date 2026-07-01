import { SignJWT, jwtVerify } from 'jose'

/**
 * BE1-2.3 · QR Token Service
 *
 * Generates and verifies signed JWS compact JWT tokens for QR passes.
 * Uses the jose library for performance and native edge compatibility.
 */
export class QrTokenService {
  private getSecretKey(): Uint8Array {
    const secret = process.env.JWT_SIGNING_SECRET || 'default-fallback-secure-signing-secret-64-bytes';
    const secret = process.env.QR_TOKEN_SECRET || process.env.JWT_SECRET || 'default-fallback-secure-signing-secret-64-bytes';
    return new TextEncoder().encode(secret);
  }

  /**
   * Generates a signed JWT containing beneficiary metadata.
   */
  async generateToken(payload: {
    beneficiaryId: string;
    childName: string;
    guardianName: string;
    tier: number;
    pin_hash_ref: string;
  }, expiresAt: string | number | Date = '30d'): Promise<string> {
    const secret = this.getSecretKey();

    return new SignJWT({
      beneficiaryId: payload.beneficiaryId,
      childName: payload.childName,
      guardianName: payload.guardianName,
      tier: payload.tier,
      pin_hash_ref: payload.pin_hash_ref,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(secret);
  }

  /**
   * Verifies and decodes a QR token.
   */
  async verifyToken(token: string): Promise<{
    beneficiaryId: string;
    childName: string;
    guardianName: string;
    tier: number;
    pin_hash_ref: string;
  }> {
    const secret = this.getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return payload as any;
  }
}
