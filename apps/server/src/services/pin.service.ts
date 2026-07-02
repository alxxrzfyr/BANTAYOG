import { hash, verify } from '@node-rs/argon2'
import { AppResult, ok, err, ValidationError } from '../lib/errors.js'

/**
 * BE1-2.3 · PIN Service
 *
 * Handles Argon2id hashing and verification of 6-digit PINs.
 */
export class PinService {
  /**
   * Hashes a 6-digit PIN using Argon2id.
   */
  async hashPin(pin: string): Promise<AppResult<string>> {
    try {
      const hashed = await hash(pin);
      return ok(hashed);
    } catch (error: any) {
      return err(new ValidationError(`PIN hashing failed: ${error.message}`));
    }
  }

  /**
   * Verifies a 6-digit PIN against an Argon2id hash.
   */
  async verifyPin(pin: string, hashString: string): Promise<AppResult<boolean>> {
    try {
      const isValid = await verify(hashString, pin);
      return ok(isValid);
    } catch (error: any) {
      return err(new ValidationError(`PIN verification failed: ${error.message}`));
    }
  }
}

