import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { WalletAdapterGateway } from './wallet-adapter.gateway.js'

// ---------------------------------------------------------------------------
// Property 5: Injected-wallet signature verification round-trip.
// Feature: polygon-amoy-phpc-migration, Property 5: Injected-wallet
// signature verification round-trip
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Property 5: injected-wallet signature verification round-trip', () => {
  it('verifies a genuine signature and returns the signer address; rejects tampered signatures or mismatched addresses', async () => {
    const gateway = new WalletAdapterGateway()

    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 200 }), async (message) => {
        const privateKey = generatePrivateKey()
        const account = privateKeyToAccount(privateKey)
        const signature = await account.signMessage({ message })

        // Genuine signature + matching address -> ok(address)
        const genuineResult = await gateway.verifyWalletConnection({
          address: account.address,
          message,
          signature,
        })
        expect(genuineResult.isOk()).toBe(true)
        if (genuineResult.isOk()) {
          expect(genuineResult.value.toLowerCase()).toBe(account.address.toLowerCase())
        }

        // Tampered signature (flip a hex character within the `r` component,
        // well before the trailing recovery-id byte which only takes a
        // handful of valid values) -> err
        const tamperChar = signature[10] === '0' ? '1' : '0'
        const tamperedSignature = (signature.slice(0, 10) + tamperChar + signature.slice(11)) as `0x${string}`
        const tamperedResult = await gateway.verifyWalletConnection({
          address: account.address,
          message,
          signature: tamperedSignature,
        })
        expect(tamperedResult.isErr()).toBe(true)

        // Mismatched address (a different, unrelated account) -> err
        const otherAccount = privateKeyToAccount(generatePrivateKey())
        const mismatchedResult = await gateway.verifyWalletConnection({
          address: otherAccount.address,
          message,
          signature,
        })
        expect(mismatchedResult.isErr()).toBe(true)
      }),
      { numRuns: 50 },
    )
  })
})
