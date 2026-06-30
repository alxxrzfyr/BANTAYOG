import { hash, verify } from '@node-rs/argon2'

/**
 * BE1-2.3 · PIN Service
 *
 * Handles Argon2id hashing and verification of 6-digit PINs.
 */
export class PinService {
  /**
   * Hashes a 6-digit PIN using Argon2id.
   */
  async hashPin(pin: string): Promise<string> {
    // Generate salt and hash
    return hash(pin);
  }

  /**
   * Verifies a 6-digit PIN against an Argon2id hash.
   */
  async verifyPin(pin: string, hashString: string): Promise<boolean> {
    try {
      return await verify(hashString, pin);
    } catch {
      return false;
    }
  }
}
