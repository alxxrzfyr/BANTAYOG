/**
 * CustodialWalletService — beneficiary EVM keypair generation, encrypted
 * custody, and signing.
 *
 * Per the polygon-amoy-phpc-migration design (Components and Interfaces §3
 * "CustodialWalletService") and the `beneficiary_wallets` data model: this
 * service generates a beneficiary's EVM keypair, verifies the derived
 * address is globally unique (retrying up to 3 attempts on collision),
 * encrypts the private key at rest with AES-256-GCM, and persists only the
 * ciphertext/iv/authTag — the plaintext key is never stored. Signing decrypts
 * the key into a `Buffer` held only for the duration of the signing call and
 * zeroizes it in a `finally` block regardless of outcome.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4
 */
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { Account } from 'viem'
import type { ChainConfig } from '../lib/chain/config.js'
import type { BeneficiaryWalletRepository } from '../repositories/beneficiary-wallet.repository.js'
import { type AppResult, ValidationError, PersistenceError, ok, err } from '../lib/errors.js'

/** AES-256-GCM cipher algorithm identifier. */
const ALGORITHM = 'aes-256-gcm'

/** GCM IV length in bytes (96-bit, the recommended size for GCM). */
const IV_LENGTH_BYTES = 12

/** Maximum keypair-generation attempts before treating generation as failed. */
const MAX_GENERATION_ATTEMPTS = 3

/**
 * The AES-256-GCM ciphertext/iv/authTag triple persisted for a beneficiary's
 * encrypted private key. The encryption key itself is never stored here —
 * it is sourced separately from `ChainConfig.keyEncryptionKey`.
 */
export interface EncryptedKey {
  /** base64-encoded ciphertext. */
  ciphertext: string
  /** base64-encoded IV, unique per record. */
  iv: string
  /** base64-encoded AES-GCM authentication tag. */
  authTag: string
}

export class CustodialWalletService {
  constructor(
    private readonly config: ChainConfig,
    private readonly repo: BeneficiaryWalletRepository,
  ) {}

  /**
   * Derives a 32-byte AES-256 key from `config.keyEncryptionKey`.
   *
   * `keyEncryptionKey` is an arbitrary-length UTF-8 string sourced from the
   * environment (Requirement 6.1: "an encryption key that is stored
   * separately from the encrypted data"). AES-256-GCM requires exactly a
   * 32-byte key, so the configured string is hashed with SHA-256 to obtain a
   * fixed-length 32-byte key deterministically, regardless of the input
   * string's length.
   */
  private deriveEncryptionKey(): Buffer {
    return createHash('sha256').update(this.config.keyEncryptionKey).digest()
  }

  /**
   * Encrypts `privateKeyBytes` with AES-256-GCM using a fresh random IV.
   */
  private encryptPrivateKey(privateKeyBytes: Buffer): EncryptedKey {
    const key = this.deriveEncryptionKey()
    const iv = randomBytes(IV_LENGTH_BYTES)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const ciphertext = Buffer.concat([cipher.update(privateKeyBytes), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    }
  }

  /**
   * Decrypts a stored {@link EncryptedKey} back into the raw private-key
   * bytes using AES-256-GCM. Throws on auth-tag mismatch or corrupted
   * ciphertext — callers must catch and must not leak the thrown error's
   * message (which may reference cipher internals) to API responses.
   */
  private decryptPrivateKey(encrypted: EncryptedKey): Buffer {
    const key = this.deriveEncryptionKey()
    const iv = Buffer.from(encrypted.iv, 'base64')
    const authTag = Buffer.from(encrypted.authTag, 'base64')
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64')
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  /**
   * Generates a new EVM keypair for `beneficiaryId`, retries up to 3 total
   * attempts if the derived address collides with an existing beneficiary's
   * wallet address, encrypts the private key with AES-256-GCM, and persists
   * only the ciphertext/iv/authTag alongside the address. Never persists a
   * plaintext or partially-encrypted key.
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1
   */
  async generateWallet(beneficiaryId: string): Promise<AppResult<{ address: `0x${string}` }>> {
    let derivedAddress: `0x${string}` | undefined
    let privateKey: `0x${string}` | undefined

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const candidateKey = generatePrivateKey()
      const candidateAddress = privateKeyToAccount(candidateKey).address

      let existing: unknown[]
      try {
        existing = await this.repo.findBy('address', candidateAddress, 1)
      } catch {
        return err(
          new PersistenceError(
            'Failed to check beneficiary wallet address uniqueness',
            'beneficiary_wallets',
          ),
        )
      }

      if (existing.length === 0) {
        derivedAddress = candidateAddress
        privateKey = candidateKey
        break
      }
    }

    if (!derivedAddress || !privateKey) {
      return err(
        new ValidationError(
          'Failed to generate a unique beneficiary wallet address after 3 attempts',
        ),
      )
    }

    // Encrypt the raw private-key bytes (strip the 0x prefix before hex decode).
    const privateKeyBytes = Buffer.from(privateKey.slice(2), 'hex')
    const encrypted = this.encryptPrivateKey(privateKeyBytes)

    try {
      await this.repo.insert({
        beneficiary_id: beneficiaryId,
        address: derivedAddress,
        enc_ciphertext: encrypted.ciphertext,
        enc_iv: encrypted.iv,
        enc_auth_tag: encrypted.authTag,
      })
    } catch {
      return err(
        new PersistenceError('Failed to persist beneficiary wallet', 'beneficiary_wallets'),
      )
    }

    return ok({ address: derivedAddress })
  }

  /**
   * Decrypts the beneficiary's stored private key into a `Buffer` held only
   * for the duration of `signFn`, derives a viem `Account` from it, invokes
   * `signFn`, and zeroizes the decrypted buffer in a `finally` block
   * regardless of whether `signFn` succeeds or throws. On decryption
   * failure, the operation aborts immediately without invoking `signFn`,
   * the stored ciphertext is left unchanged, and the returned error excludes
   * all key material.
   *
   * Note: the derived `0x${hex}` private-key string handed to
   * `privateKeyToAccount` cannot itself be zeroized — JS strings are
   * immutable. This is a known limitation of the language; it is mitigated
   * by keeping the string's scope local to this method and never storing or
   * returning it beyond this call.
   *
   * Requirements: 5.1 (signing over the generated wallet), 6.2, 6.3, 6.4
   */
  async signWithBeneficiaryKey<T>(
    beneficiaryId: string,
    signFn: (account: Account) => Promise<T>,
  ): Promise<AppResult<T>> {
    let rows: { enc_ciphertext: string; enc_iv: string; enc_auth_tag: string }[]
    try {
      rows = await this.repo.findBy('beneficiary_id', beneficiaryId, 1)
    } catch {
      return err(
        new PersistenceError('Failed to look up beneficiary wallet', 'beneficiary_wallets'),
      )
    }

    const row = rows[0]
    if (!row) {
      return err(new ValidationError('No wallet found for beneficiary'))
    }

    let keyBuffer: Buffer | undefined
    try {
      keyBuffer = this.decryptPrivateKey({
        ciphertext: row.enc_ciphertext,
        iv: row.enc_iv,
        authTag: row.enc_auth_tag,
      })
    } catch {
      // Decryption failed (e.g. auth tag mismatch or corrupted ciphertext).
      // Abort without signing; the stored row is never touched, and no key
      // material is included in the error.
      return err(new ValidationError('Failed to decrypt beneficiary wallet key'))
    }

    try {
      const privateKeyHex = `0x${keyBuffer.toString('hex')}` as `0x${string}`
      const account = privateKeyToAccount(privateKeyHex)
      const result = await signFn(account)
      return ok(result)
    } catch {
      return err(new ValidationError('Signing operation failed'))
    } finally {
      // Zeroize the decrypted key buffer whether signing succeeded or threw.
      keyBuffer.fill(0)
    }
  }
}
