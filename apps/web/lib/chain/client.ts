/**
 * Blockchain client configuration (viem)
 *
 * Provides:
 *   - publicClient: read-only RPC client
 *   - walletClient: server-side signing client (uses DEPLOYER_PRIVATE_KEY)
 *
 * All env vars are loaded server-side only (never exposed to browser).
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getRoninRpcUrl, getDeployerPrivateKey } from "@/lib/env";

// ---------------------------------------------------------------------------
// Hardhat local chain config
// ---------------------------------------------------------------------------

export function getHardhatChain(): Chain {
  const rpcUrl = getRoninRpcUrl();
  return {
    id: 31337,
    name: "Hardhat Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  };
}

// ---------------------------------------------------------------------------
// Lazy singletons
// ---------------------------------------------------------------------------

let _publicClient: PublicClient | null = null;
let _walletClient: WalletClient | null = null;
let _account: Account | null = null;

/**
 * Returns a read-only viem public client connected to the local Hardhat node.
 */
export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: getHardhatChain(),
      transport: http(),
    });
  }
  return _publicClient;
}

/**
 * Returns the server-side wallet account derived from DEPLOYER_PRIVATE_KEY.
 */
export function getServerAccount(): Account {
  if (!_account) {
    _account = privateKeyToAccount(getDeployerPrivateKey());
  }
  return _account;
}

/**
 * Returns a read-write viem wallet client using the deployer account.
 * Used for server-side transaction signing (allocateCredits, transfers, etc.).
 */
export function getWalletClient(): WalletClient {
  if (!_walletClient) {
    _walletClient = createWalletClient({
      account: getServerAccount(),
      chain: getHardhatChain(),
      transport: http(),
    });
  }
  return _walletClient;
}

/**
 * Reset cached clients (useful in tests to pick up new env vars).
 */
export function resetChainClients(): void {
  _publicClient = null;
  _walletClient = null;
  _account = null;
}
