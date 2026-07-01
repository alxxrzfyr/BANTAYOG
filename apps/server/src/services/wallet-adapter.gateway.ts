import { verifyMessage } from 'viem'

export class WalletAdapterGateway {
  /**
   * Verifies the wallet connection and returns the verified wallet address.
   * Supports:
   *  - 'injected': standard EIP-1193 signature verification
   *  - 'tanto': signature verification (Tanto uses signed messages)
   *  - 'waypoint': OAuth token-based verification (stubbed for test environments)
   */
  async verifyWalletConnection(
    method: 'waypoint' | 'tanto' | 'injected',
    proof: {
      address: string
      message?: string
      signature?: string
      token?: string
    }
  ): Promise<string> {
    if (method === 'injected' || method === 'tanto') {
      if (!proof.signature || !proof.message) {
        throw new Error('Signature and message are required for signature-based verification')
      }

      const isValid = await verifyMessage({
        address: proof.address as `0x${string}`,
        message: proof.message,
        signature: proof.signature as `0x${string}`,
      })

      if (!isValid) {
        throw new Error('Invalid wallet signature verification failed')
      }

      return proof.address
    } else if (method === 'waypoint') {
      // Waypoint OAuth token-based verification stub
      if (!proof.token) {
        throw new Error('OAuth token is required for Waypoint verification')
      }
      
      // In development/test mode, we assume the provided address is verified if a token exists
      return proof.address
    } else {
      throw new Error(`Unsupported wallet connection method: ${method}`)
    }
  }
}
