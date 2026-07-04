import { verifyMessage } from 'viem'
import { type AppResult, ok, err, AuthError } from '../lib/errors.js'

export class WalletAdapterGateway {
  /**
   * Verifies an injected-wallet (EIP-1193) signature and returns the
   * verified wallet address, or an AuthError on a missing proof,
   * tampered signature, or mismatched address.
   */
  async verifyWalletConnection(proof: {
    address: string
    message?: string
    signature?: string
  }): Promise<AppResult<string>> {
    if (!proof.signature || !proof.message) {
      return err(new AuthError('Signature and message are required for wallet verification', 'invalid_credentials'))
    }

    try {
      const isValid = await verifyMessage({
        address: proof.address as `0x${string}`,
        message: proof.message,
        signature: proof.signature as `0x${string}`,
      })

      if (!isValid) {
        return err(new AuthError('Invalid wallet signature', 'invalid_credentials'))
      }

      return ok(proof.address)
    } catch {
      return err(new AuthError('Wallet signature verification failed', 'invalid_credentials'))
    }
  }
}
